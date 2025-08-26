# path: backend/app/db_audit_eval.py
from __future__ import annotations

import os
import json
from typing import List, Dict, Any

from app.schemas.db import DBFacts
from app.schemas.db_audit import DBCheckResult

# ----------------- Config -----------------

CHROMA_PATH = os.getenv(
    "CHROMA_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/regs")),
)
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "ksa_regs")

# Optional envs for parity with project
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", os.getenv("CHAT_MODEL", "gpt-4o"))
LLM_MODEL = os.getenv("LLM_MODEL", CHAT_MODEL)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


# ----------------- Retrieval (single collection, NCA-only) -----------------

def _retrieve_nca_excerpts(topic: str, top_k: int = 3) -> List[str]:
    """
    Query the single Chroma collection, hard-filtered to authority='NCA'.
    Return lightweight citations like '<title>:<page>:NCA'.
    """
    try:
        from chromadb import PersistentClient  # type: ignore
        client = PersistentClient(path=CHROMA_PATH)
        col = client.get_or_create_collection(CHROMA_COLLECTION)
        res = col.query(
            query_texts=[topic],
            n_results=top_k,
            where={"authority": "NCA"},
        )
        docs = res.get("documents") or [[]]
        metas = res.get("metadatas") or [[]]
        out: List[str] = []
        for _, meta in zip(docs[0], metas[0]):
            title = (meta or {}).get("title") or (meta or {}).get("source") or "NCA"
            page = (meta or {}).get("page") or (meta or {}).get("pageno") or ""
            authority = (meta or {}).get("authority") or "NCA"
            out.append(f"{title}:{page}:{authority}")
        if out:
            return out
    except Exception:
        pass
    # Minimal safe fallback to uploaded NCA PDFs (still NCA-only)
    return [
        "STANDARD_Database_Security_template_en-.pdf:1:NCA",
        "STANDARD_Database_Security_template_en-.pdf:7:NCA",
        "POLICY_Database_Security_template_en-.pdf:5:NCA",
    ]


# ----------------- LLM utilities -----------------

def _get_openai_client():
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set; LLM evaluation required but unavailable.")
    # Try new SDK
    try:
        from openai import OpenAI  # type: ignore
        client = OpenAI(api_key=OPENAI_API_KEY)
        return "new", client
    except Exception:
        pass
    # Try legacy SDK
    try:
        import openai  # type: ignore
        openai.api_key = OPENAI_API_KEY
        return "legacy", openai
    except Exception as e:
        raise RuntimeError(f"OpenAI client init failed: {type(e).__name__}: {e}")


def _build_llm_prompt(facts: DBFacts) -> List[Dict[str, str]]:
    topics = [
        ("NCA-DB-TLS-01", "Transport Security", "TLS in transit"),
        ("NCA-DB-ATREST-02", "Encryption at Rest", "Encryption at rest"),
        ("NCA-DB-LOG-03", "Audit & Logging", "Audit logging breadth"),
        ("NCA-DB-BDR-04", "Backup & DR", "Backup & DR posture"),
        ("NCA-DB-PWD-05", "Identity & Authentication", "Password hashing"),
        ("NCA-DB-PRIV-06", "Access Control", "Privileged access"),
        ("NCA-DB-PWD-POL-07", "Identity & Authentication", "Password policy strength"),
        ("NCA-DB-PWD-ROT-08", "Identity & Authentication", "Password rotation"),
    ]
    cites_by_topic = {t[2]: _retrieve_nca_excerpts(t[2]) for t in topics}

    system_msg = (
        "You are a database security compliance auditor. "
        "You will receive factual evidence about a live database plus NCA-only citations. "
        "For each check, you must decide PASS/FAIL/MANUAL strictly from the evidence. "
        "Produce: control_id, section, requirement (short excerpt), verdict, evidence (subset of given facts), "
        "remediation (clear, actionable), priority (High/Medium/Low), citations (must come only from provided list), topic. "
        "Return STRICT JSON with one top-level key: 'checks' (array). No prose."
    )

    user_payload = {
        "facts": json.loads(facts.model_dump_json()),
        "topics": [
            {
                "control_id": cid,
                "section": sec,
                "topic": topic,
                "citations": cites_by_topic.get(topic, []),
            }
            for (cid, sec, topic) in topics
        ],
        "verdict_options": ["PASS", "FAIL", "MANUAL"],
        "rules": [
            "Use only the provided citations; do not fabricate or add non-NCA sources.",
            "Be conservative: if evidence is missing/ambiguous → MANUAL with explicit evidence to collect.",
            "All fields (verdict, priority, remediation) are your decision—do not mirror examples.",
        ],
    }

    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def _parse_llm_json(text: str) -> List[DBCheckResult]:
    data = json.loads(text)
    if "checks" not in data or not isinstance(data["checks"], list):
        raise RuntimeError("LLM JSON missing 'checks' array")
    return [DBCheckResult(**item) for item in data["checks"]]


# ----------------- Public API -----------------

from app.db_collector import collect_db_facts

def evaluate_db_against_nca(facts: DBFacts) -> List[DBCheckResult]:
    """
    LLM-only evaluation. If the LLM is unavailable or returns invalid JSON, we raise.
    No hardcoded verdicts/remediations are produced here.
    """
    mode, client = _get_openai_client()
    messages = _build_llm_prompt(facts)

    if mode == "new":
        resp = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content or "{}"
        return _parse_llm_json(text)

    # legacy
    resp = client.ChatCompletion.create(  # type: ignore[attr-defined]
        model=LLM_MODEL,
        messages=messages,
        temperature=0,
    )
    text = resp["choices"][0]["message"]["content"] or "{}"
    return _parse_llm_json(text)


def run_db_audit(*, dsn: str) -> list[DBCheckResult]:
    """
    Collect facts -> LLM evaluation (NCA-only retrieval for citations) -> results.
    DSN is REQUIRED (per-request); there is no .env fallback.
    """
    facts = collect_db_facts(dsn)
    return evaluate_db_against_nca(facts)
