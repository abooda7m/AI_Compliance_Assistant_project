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

EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHAT_MODEL  = os.getenv("OPENAI_CHAT_MODEL",  "gpt-5-nano")  # safe default
BASE_DIR    = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHROMA_PATH = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "chroma_db", "regs"))
COLLECTION  = os.getenv("CHROMA_COLLECTION", "ksa_regs")  # unified collection


# ---- Metadata helpers --------------------------------------------------------

def _meta_basename(meta: dict) -> str:
    """Prefer 'file' then basename(source) then '?'."""
    if meta.get("file"):
        return meta["file"]
    src = meta.get("source") or meta.get("source_file")
    if src:
        try:
            import os as _os
            return _os.path.basename(src)
        except Exception:
            return src
    return "?"


def _authority(meta: dict) -> str:
    """Return authority when present, else group or domain, else '?'."""
    return meta.get("authority") or meta.get("group") or meta.get("domain") or "?"


def _section_from_text(text: str) -> str:
    """
    Lightweight heading pick, no regex.
    Prefer a line starting with Article, Section, Clause. Else first non-empty line.
    """
    text = text or ""
    for key in ("Article", "Section", "Clause"):
        pos = text.find(key)
        if pos != -1:
            line = text[pos:].splitlines()[0].strip()
            return (line[:140] + "…") if len(line) > 140 else line
    for line in text.splitlines():
        line = line.strip()
        if line:
            return (line[:140] + "…") if len(line) > 140 else line
    return "Not specified"


def _section(meta: dict, text: str) -> str:
    """Prefer metadata.section else derive from text."""
    sec = (meta.get("section") or "").strip()
    if not sec:
        return _section_from_text(text)
    return sec[:200]


def _ctx_header(meta: dict, text: str) -> str:
    """
    Unified context header. Copyable into answers and used for inline citation.
    Example: [SDAIA] Law.pdf | page 12 | section: Article 5 X
    """
    return f"[{_authority(meta)}] {_meta_basename(meta)} | page {meta.get('page','?')} | section: {_section(meta, text)}"


def _format_context_block(doc) -> str:
    m = getattr(doc, "metadata", {}) or {}
    return _ctx_header(m, getattr(doc, "page_content", "") or "") + "\n" + (getattr(doc, "page_content", "") or "").strip()


def _make_citations(docs: List) -> List[str]:
    out, seen = [], set()
    for d in docs:
        m = getattr(d, "metadata", {}) or {}
        s = f"{_meta_basename(m)} | page {m.get('page','?')} | {_authority(m)}"
        if s not in seen:
            out.append(s)
            seen.add(s)
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


# ---- JSON parsing and section fix -------------------------------------------

def safe_json(text: str) -> dict:
    """Parse model output robustly. Try direct loads, else first {...} block."""
    try:
        return json.loads(text)
    except Exception:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass
    return {"verdict": "unclear", "violations": []}


def fix_section_no_regex(item: dict, context_docs: List) -> None:
    """
    Ensure 'section' is a sensible title from regulation context, no regex.
    Replace empty or metadata-like values. If claimed section not found in any
    context doc, derive from the first context doc.
    """
    if not context_docs:
        item["section"] = item.get("section") or "Not specified"
        return
    sec = (item.get("section") or "").strip()
    bad_vals = {"sdaia", "group", "n/a", "na"}
    if not sec or sec.lower() in bad_vals:
        item["section"] = _section_from_text(context_docs[0].page_content)
        return
    if not any(sec in d.page_content for d in context_docs):
        item["section"] = _section_from_text(context_docs[0].page_content)


# ---- Vector DB ---------------------------------------------------------------

def build_regs_db() -> Chroma:
    emb = OpenAIEmbeddings(model=EMBED_MODEL)
    return Chroma(
        persist_directory=CHROMA_PATH,
        collection_name=COLLECTION,
        embedding_function=emb,
    )


# ---- Main entry --------------------------------------------------------------

def audit_uploaded_file(path: str, k: int = 4, min_rel: float = 0.35) -> dict:
    """
    Audit an uploaded policy document against the configured regulations.

    Returns:
      {
        "score": float,
        "breakdown": {assessed, compliant, non_compliant, unclear},
        "violations": List[dict],
        "citations": List[str]
      }

    Scoring:
      score = 100 * compliant / assessed
    """
    db = build_regs_db()
    llm = ChatOpenAI(temperature=0, model=CHAT_MODEL)

    # 1) Chunk the uploaded file
    chunks = load_and_chunk(path, chunk_size=800, overlap=100)

    violations: List[dict] = []
    citations: List[str] = []
    compliant = non_compliant = unclear = 0

    # 2) For each chunk, retrieve strong regs context then ask the LLM
    for ch in chunks[:60]:  # cap for speed and cost
        pairs = db.similarity_search_with_relevance_scores(ch.page_content, k=k)
        strong_docs = [d for d, s in pairs if (math.ceil(s * 20) / 20) >= min_rel][:4]

        if not strong_docs:
            unclear += 1
            continue

        reg_context = "\n\n---\n\n".join(_format_context_block(d) for d in strong_docs)
        citations.extend(_make_citations(strong_docs))

        prompt = AUDIT_PROMPT.format(
            reg_context=reg_context,
            policy_chunk=ch.page_content.strip()[:2000],
        )

        raw = llm.predict(prompt)
        parsed = safe_json(raw)

        # Normalize into the unified outcome
        # If model followed this file's schema:
        if "is_compliant" in parsed:
            is_ok = bool(parsed.get("is_compliant", False))
            vlist = parsed.get("violations") or []
            if is_ok and not vlist:
                compliant += 1
            else:
                non_compliant += 1
                # Normalize and patch each violation
                for v in vlist:
                    docname = v.get("document") or _meta_basename(getattr(strong_docs[0], "metadata", {}) or {})
                    page    = v.get("page") or "Not specified"
                    sect    = v.get("section") or "Not specified"
                    cite    = v.get("regulation_citation") or ""
                    val     = v.get("value") or ""
                    expl    = v.get("explanation") or ""
                    item = {
                        "document": docname,
                        "page": page,
                        "section": sect,
                        "regulation_citation": cite,
                        "value": val,
                        "explanation": expl,
                    }
                    fix_section_no_regex(item, strong_docs)
                    violations.append(item)
        else:
            # If model followed the alternate schema with "verdict"
            verdict = (parsed.get("verdict") or "unclear").strip().lower()
            if verdict == "compliant":
                compliant += 1
            elif verdict == "non-compliant":
                non_compliant += 1
            else:
                unclear += 1

            for item in parsed.get("violations", []):
                item.setdefault("document", _meta_basename(getattr(strong_docs[0], "metadata", {}) or {}))
                item.setdefault("page", "Not specified")
                item.setdefault("section", "Not specified")
                item.setdefault("regulation_citation", "")
                item.setdefault("value", "")
                item.setdefault("explanation", "")
                fix_section_no_regex(item, strong_docs)
                violations.append(item)

    # 3) Summaries
    assessed = compliant + non_compliant + unclear
    score = round(100.0 * compliant / assessed, 2) if assessed else 0.0

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
