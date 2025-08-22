# app/audit_policy.py

import os
import json
import math
from typing import List, Tuple

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.prompts import ChatPromptTemplate

from app.utils_files import load_and_chunk  # existing chunker


# ---- Configuration -----------------------------------------------------------

EMBED_MODEL   = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHAT_MODEL    = os.getenv("OPENAI_CHAT_MODEL",  "gpt-5-nano")  # safe default
BASE_DIR      = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHROMA_PATH   = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "chroma_db", "regs"))
COLLECTION    = os.getenv("CHROMA_COLLECTION", "ksa_regs")     # unified collection

# ---- Metadata helpers --------------------------------------------------------

def _meta_basename(meta: dict) -> str:
    """
    Prefer our 'file' metadata from ingestion; fall back to basename of 'source'.
    """
    if meta.get("file"):
        return meta["file"]
    src = meta.get("source")
    if src:
        try:
            import os as _os
            return _os.path.basename(src)
        except Exception:
            return src
    return "?"

def _authority(meta: dict) -> str:
    """Return authority (NCA/SDAIA) when present; fall back to 'domain'."""
    return meta.get("authority") or meta.get("domain") or "?"

def _section(meta: dict, text: str) -> str:
    """Pick a readable section header: explicit metadata.section else first line of text."""
    sec = (meta.get("section") or "").strip()
    if not sec:
        line = (text or "").strip().splitlines()[0:1]
        return line[0][:200] if line else "General"
    return sec[:200]

def _format_context_block(doc) -> str:
    m = getattr(doc, "metadata", {}) or {}
    header = f"[{_authority(m)}] {_meta_basename(m)} | page {m.get('page','?')} | section: {_section(m, getattr(doc,'page_content',''))}"
    return header + "\n" + (getattr(doc, "page_content", "") or "").strip()

def _make_citations(docs: List) -> List[str]:
    out, seen = [], set()
    for d in docs:
        m = getattr(d, "metadata", {}) or {}
        s = f"{_meta_basename(m)} | page {m.get('page','?')} | {_authority(m)}"
        if s not in seen:
            out.append(s); seen.add(s)
    return out


# ---- Prompt -----------------------------------------------------------------

AUDIT_PROMPT = ChatPromptTemplate.from_template(
    """You are a strict compliance auditor. Use ONLY the provided regulation context to judge the user policy chunk.
Return a compact JSON object with this exact structure (no extra keys, no commentary):

{{
  "is_compliant": true|false,
  "violations": [
    {{
      "document": "Name of the regulation document in the context",
      "page": "e.g., 12 or 'Not specified'",
      "section": "Copy the section/article title or the first heading-like line; otherwise 'Not specified'",
      "regulation_citation": "filename | page | authority",
      "value": "Quote the specific policy text that violates the regulation (or summarize succinctly)",
      "explanation": "One sentence explaining why this violates the cited regulation"
    }}
  ]
}}

Rules:
- Use only the regulation context provided.
- The "section" should be copied from the regulation text when available; otherwise derive a short heading from the first line.
- If the context is insufficient to assess, set "is_compliant": true and return an empty 'violations' list.

# Regulation context
{reg_context}

# User policy chunk
{policy_chunk}
"""
)

# ---- Main entry --------------------------------------------------------------

def audit_uploaded_file(path: str, k: int = 4, min_rel: float = 0.35) -> dict:
    """
    Audits an uploaded policy document against the configured regulations.
    Returns a dict with: score, breakdown, violations, citations.

    Scoring: 100 * (# compliant chunks) / (# assessed chunks).
    """
    embeddings = OpenAIEmbeddings(model=EMBED_MODEL)
    db = Chroma(
        persist_directory=CHROMA_PATH,
        collection_name=COLLECTION,
        embedding_function=embeddings,
    )
    model = ChatOpenAI(temperature=0, model=CHAT_MODEL)

    # 1) Chunk the uploaded file
    chunks = load_and_chunk(path, chunk_size=800, overlap=100)

    violations: List[dict] = []
    citations:  List[str]  = []
    compliant = non_compliant = unclear = 0

    # 2) For each chunk: retrieve strong regs context -> ask the LLM
    for ch in chunks[:60]:  # cap for speed/safety
        pairs  = db.similarity_search_with_relevance_scores(ch.page_content, k=k)
        # Rounded-up threshold to keep behavior deterministic
        strong_docs = [d for d, s in pairs if (math.ceil(s*20)/20) >= min_rel][:4]

        if not strong_docs:
            unclear += 1
            continue

        reg_context = "\n\n---\n\n".join(_format_context_block(d) for d in strong_docs)
        citations.extend(_make_citations(strong_docs))

        prompt = AUDIT_PROMPT.format(
            reg_context=reg_context,
            policy_chunk=ch.page_content.strip()[:2000],
        )

        raw = model.predict(prompt)
        # tolerant JSON parse
        parsed = None
        try:
            start = raw.find("{"); end = raw.rfind("}")
            if start != -1 and end != -1:
                parsed = json.loads(raw[start:end+1])
        except Exception:
            parsed = None

        if not parsed or not isinstance(parsed, dict):
            # On parsing failure, mark as unclear to avoid false violations
            unclear += 1
            continue

        is_ok = bool(parsed.get("is_compliant", False))
        vlist = parsed.get("violations") or []
        if is_ok and not vlist:
            compliant += 1
        else:
            non_compliant += 1
            # Normalize each violation item minimally
            for v in vlist:
                docname = v.get("document") or "Regulation context"
                page    = v.get("page") or "Not specified"
                sect    = v.get("section") or "Not specified"
                cite    = v.get("regulation_citation") or ""
                val     = v.get("value") or ""
                expl    = v.get("explanation") or ""
                violations.append({
                    "document": docname,
                    "page": page,
                    "section": sect,
                    "regulation_citation": cite,
                    "value": val,
                    "explanation": expl,
                })

    # 3) Summaries
    assessed = compliant + non_compliant + unclear
    score = round(100.0 * compliant / assessed, 1) if assessed else 0.0

    # dedupe citations, keep order
    citations = list(dict.fromkeys(citations))

    return {
        "score": score,
        "breakdown": {
            "assessed": assessed,
            "compliant": compliant,
            "non_compliant": non_compliant,
            "unclear": unclear,
        },
        "violations": violations,
        "citations": citations,
    }
