# path: backend/app/db_audit_eval.py
from __future__ import annotations

import os
import json
from typing import List, Dict, Any, Tuple

from app.schemas.db import DBFacts
from app.schemas.db_audit import DBCheckResult

# ----------------- Config -----------------

CHROMA_PATH = os.getenv(
    "CHROMA_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/regs")),
)
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "ksa_regs")

# Optional envs for parity with project
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")  # 3072 dim
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", os.getenv("CHAT_MODEL", "gpt-4o"))
LLM_MODEL = os.getenv("LLM_MODEL", CHAT_MODEL)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


# ----------------- Retrieval (single collection, NCA-only) -----------------

def _retrieve_nca_excerpts(topic: str, top_k: int = 5) -> List[str]:
    """
    Query the Chroma collection and build citations STRICTLY from metadata.
    Format: "<title>:<page>:<authority>".
    - No hardcoded fallbacks.
    - Accepts authority under 'authority' or 'group' (per your ingester).
    - Accepts page under 'page', 'pageno', or 'page_label'.
    - Accepts title under 'title', 'source', or 'source_file'.

    Raises RuntimeError if collection is missing/empty or results lack usable metadata.
    """
    # 0) Import Chroma client + embedding function
    try:
        from chromadb import PersistentClient  # type: ignore
        from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "NCA citation retrieval requires 'chromadb' and its embedding_functions. "
            f"Import failed: {type(e).__name__}: {e}"
        )

    if not OPENAI_API_KEY:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Your collection was created with an OpenAI "
            f"embedding ({EMBED_MODEL}); querying requires the same embedding to avoid "
            "dimension mismatch errors."
        )

    # 1) Build embedding function to match ingestion (e.g., text-embedding-3-large => 3072)
    try:
        embedding_fn = OpenAIEmbeddingFunction(
            api_key=OPENAI_API_KEY,
            model_name=EMBED_MODEL,
        )
    except Exception as e:
        raise RuntimeError(
            f"Failed to initialize OpenAIEmbeddingFunction for '{EMBED_MODEL}': {type(e).__name__}: {e}"
        )

    # 2) Open collection with matching embedding function
    try:
        client = PersistentClient(path=CHROMA_PATH)
        col = client.get_or_create_collection(
            CHROMA_COLLECTION, embedding_function=embedding_fn  # type: ignore[call-arg]
        )
        if hasattr(col, "count") and callable(col.count) and col.count() == 0:
            raise RuntimeError(
                f"Chroma collection '{CHROMA_COLLECTION}' at '{CHROMA_PATH}' is empty. "
                "Ingest NCA PDFs with metadata (authority/group + title/source_file + page/page_label) first."
            )
    except Exception as e:
        raise RuntimeError(
            f"Cannot open Chroma collection '{CHROMA_COLLECTION}' at '{CHROMA_PATH}': {type(e).__name__}: {e}"
        )

    # 3) Query strictly for NCA authority; prefer 'authority', then fall back to 'group'
    def _query(where: Dict[str, Any]) -> Dict[str, Any]:
        return col.query(  # type: ignore[call-arg]
            query_texts=[topic],
            n_results=top_k,
            where=where,
        ) or {}

    try:
        res = _query({"authority": "NCA"})
        metas = (res.get("metadatas") or [[]])[0]
        if not metas:
            # retry with 'group' == 'NCA' (your ingester uses this field)
            res = _query({"group": "NCA"})
            metas = (res.get("metadatas") or [[]])[0]
        if not metas:
            # last resort: query without where, then post-filter by authority/group == NCA
            res = _query({})
            metas = (res.get("metadatas") or [[]])[0]
    except Exception as e:
        raise RuntimeError(
            f"NCA retrieval failed for topic '{topic}' against collection "
            f"'{CHROMA_COLLECTION}' at '{CHROMA_PATH}': {type(e).__name__}: {e}"
        )

    if not metas:
        raise RuntimeError(
            f"NCA retrieval returned no results for topic '{topic}'. "
            "Ensure the collection contains NCA docs with metadata."
        )

    # 4) Build citations ONLY from metadata, enforcing NCA via 'authority' or 'group'
    out: List[str] = []
    for meta in metas:
        m = meta or {}
        # Determine authority tag
        authority = m.get("authority") or m.get("group")  # your ingester sets 'group' = authority
        if authority != "NCA":
            continue  # skip non-NCA
        # Determine title/source
        title = m.get("title") or m.get("source") or m.get("source_file")
        # Determine page label
        page = m.get("page")
        if page is None:
            page = m.get("pageno")
        if page is None:
            page = m.get("page_label")
        # Accept string/int pages; reject missing
        if not title or page is None:
            continue
        out.append(f"{title}:{page}:{authority}")

    if not out:
        raise RuntimeError(
            "NCA retrieval returned results, but none had usable metadata. "
            "Expected at least: ('authority'=='NCA' or 'group'=='NCA'), and a title "
            "('title' or 'source' or 'source_file'), and a page ('page' or 'pageno' or 'page_label')."
        )

    return out


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
    No hardcoded verdicts/remediations/citations are produced here.
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


# ----------------- Summary helpers (PLAIN TEXT, ONE PARAGRAPH) -----------------

def _project_checks_for_summary(checks: List[DBCheckResult]) -> List[Dict[str, Any]]:
    """Reduce each check to key fields for compact summarization."""
    projected: List[Dict[str, Any]] = []
    for c in checks:
        projected.append({
            "control_id": c.control_id,
            "section": c.section,
            "topic": c.topic,
            "verdict": c.verdict,
            "priority": c.priority,
            "remediation": c.remediation,
            "citations": c.citations or [],
        })
    return projected


def _build_summary_prompt(checks: List[DBCheckResult]) -> List[Dict[str, str]]:
    """
    Build a strict-JSON prompt asking for a concise PLAIN-TEXT summary.
    No Markdown, asterisks, bullets, lists, or line breaks. ONE PARAGRAPH only.
    """
    projected = _project_checks_for_summary(checks)

    total = len(projected)
    pass_count = sum(1 for x in projected if (x.get("verdict") or "").upper() == "PASS")
    fail_count = sum(1 for x in projected if (x.get("verdict") or "").upper() == "FAIL")
    manual_count = sum(1 for x in projected if (x.get("verdict") or "").upper() == "MANUAL")
    high_risks = [
        {"control_id": x["control_id"], "topic": x["topic"], "section": x["section"]}
        for x in projected
        if (x.get("priority") or "").lower() == "high" and (x.get("verdict") or "").upper() == "FAIL"
    ]

    system_msg = (
        "You are a security audit reporter. Summarize database audit results as PLAIN TEXT. "
        "Return STRICT JSON with a single key 'summary' whose value is ONE PARAGRAPH of plain text. "
        "Do NOT use Markdown, asterisks, bullets, numbered lists, emojis, or any '\\n' line breaks. "
        "Keep it about 120–180 words. Only summarize what is in the provided checks/stats."
    )

    user_payload = {
        "stats": {
            "total_checks": total,
            "pass": pass_count,
            "fail": fail_count,
            "manual": manual_count,
            "high_risk_fails": high_risks,
        },
        "checks": projected,
    }

    return [
        {"role": "system", "content": system_msg},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]


def summarize_db_audit_with_llm(checks: List[DBCheckResult]) -> str:
    """
    Ask the LLM for a concise PLAIN-TEXT summary of the produced checks.
    Returns a single-paragraph plain text string under 'summary'.
    Sanitizes '**' and any line breaks just in case.
    """
    mode, client = _get_openai_client()
    messages = _build_summary_prompt(checks)

    if mode == "new":
        resp = client.chat.completions.create(
            model=LLM_MODEL,
            messages=messages,
            temperature=0,
            response_format={"type": "json_object"},
        )
        text = resp.choices[0].message.content or "{}"
    else:
        # legacy SDK (no structured response_format)
        resp = client.ChatCompletion.create(  # type: ignore[attr-defined]
            model=LLM_MODEL,
            messages=messages,
            temperature=0,
        )
        text = resp["choices"][0]["message"]["content"] or "{}"

    try:
        payload = json.loads(text)
    except Exception as e:
        raise RuntimeError(f"Summary LLM did not return valid JSON: {type(e).__name__}: {e}")

    summary = payload.get("summary") or payload.get("summary_markdown") or ""
    if not isinstance(summary, str) or not summary.strip():
        raise RuntimeError("Summary LLM JSON missing non-empty 'summary'")

    # Sanitize to strict plain text: remove '**' and any line breaks (actual or escaped).
    summary = summary.replace("**", "")
    summary = summary.replace("\\n", " ").replace("\n", " ").replace("\r", " ")
    summary = " ".join(summary.split())  # collapse extra spaces

    return summary


# ----------------- Public pipeline wrapper -----------------

def run_db_audit(*, dsn: str) -> Tuple[List[DBCheckResult], str]:
    """
    Collect facts -> LLM evaluation (NCA-only retrieval for citations) -> summary.
    Returns (evaluate_db_against_nca(facts), summary)
    """
    facts = collect_db_facts(dsn)
    checks = evaluate_db_against_nca(facts)
    summary = summarize_db_audit_with_llm(checks)
    return checks, summary
