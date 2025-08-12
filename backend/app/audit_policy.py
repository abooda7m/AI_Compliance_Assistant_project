# app/audit_policy.py

import os
import json
from typing import List

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.prompts import ChatPromptTemplate

from app.utils_files import load_and_chunk  # your existing chunker

# ---- Configuration -----------------------------------------------------------

EMBED_MODEL   = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHAT_MODEL    = os.getenv("OPENAI_CHAT_MODEL",  "gpt-5-nano")  # or your preferred model
BASE_DIR      = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHROMA_PATH   = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "chroma_db", "regs"))
COLLECTION    = os.getenv("CHROMA_COLLECTION", "langchain")     # match your DB collection

# ---- Helpers (no regex) ------------------------------------------------------

def extract_section_simple(text: str) -> str:
    """
    Prefer a heading-like line using only basic string ops (no regex).
    """
    for key in ("Article", "Section", "Clause"):
        pos = text.find(key)
        if pos != -1:
            line = text[pos:].splitlines()[0].strip()
            return (line[:140] + "…") if len(line) > 140 else line
    # Fallback: first non-empty line
    for line in text.splitlines():
        line = line.strip()
        if line:
            return (line[:140] + "…") if len(line) > 140 else line
    return "Not specified"


def fix_section_no_regex(item: dict, context_docs: List) -> None:
    """
    Ensure 'section' is a sensible title from the provided regulation context.
    Does not use regex. If the model gave an empty/metadata value, derive from the
    first context doc. If the provided section text isn't actually in the context,
    also derive from the first context doc.
    """
    if not context_docs:
        item["section"] = item.get("section") or "Not specified"
        return

    sec = (item.get("section") or "").strip()
    bad_vals = {"sdaia", "group", "n/a", "na"}

    if not sec or sec.lower() in bad_vals:
        item["section"] = extract_section_simple(context_docs[0].page_content)
        return

    # If the claimed section text doesn't appear in any context doc, fallback
    if not any(sec in d.page_content for d in context_docs):
        item["section"] = extract_section_simple(context_docs[0].page_content)


def safe_json(text: str) -> dict:
    """
    Parse model output robustly without requiring JSON-mode.
    Tries direct json.loads, then extracts the first {...} block.
    """
    try:
        return json.loads(text)
    except Exception:
        pass

    # crude brace extraction (still no regex)
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except Exception:
            pass

    return {"verdict": "unclear", "violations": []}


# ---- Vector DB ---------------------------------------------------------------

def build_regs_db() -> Chroma:
    emb = OpenAIEmbeddings(model=EMBED_MODEL)
    return Chroma(
        persist_directory=CHROMA_PATH,
        collection_name=COLLECTION,
        embedding_function=emb,
    )


# ---- Prompt (escape braces!) -------------------------------------------------

AUDIT_PROMPT = ChatPromptTemplate.from_template(
"""You are a regulatory compliance assistant specialized in SDAIA regulations.
Using only the provided regulation context, assess the user policy chunk. Return **JSON only**:

{{
  "verdict": "compliant|non-compliant|unclear",
  "violations": [
    {{
      "document": "...",
      "page": "...",
      "section": "...",    // MUST be copied from the regulation text below; if unsure use "Not specified"
      "regulation_citation": "file | page | group",
      "explanation": "..."
    }}
  ]
}}

Rules:
- Use only the regulation context provided.
- The "section" MUST be copied verbatim from the regulation text below; if unsure use "Not specified".
- NEVER set "section" to metadata like "Sdaia" or "group".

# Regulation context
{reg_context}

# User policy chunk
{policy_chunk}
"""
)

# ---- Main entry --------------------------------------------------------------

def audit_uploaded_file(path: str, k: int = 6, min_rel: float = 0.5) -> dict:
    """
    Audits an uploaded policy document against SDAIA regs.
    Returns a dict with: score, breakdown, violations, citations.

    Scoring: 100 * (# compliant chunks) / (# assessed chunks).
    'unclear' counts as not compliant.
    """
    db  = build_regs_db()
    llm = ChatOpenAI(
        model_name=CHAT_MODEL
    )

    # 1) Chunk the uploaded file
    chunks = load_and_chunk(path, chunk_size=800, overlap=100)

    violations: List[dict] = []
    citations:  List[str]  = []
    compliant = non_compliant = unclear = 0

    # 2) For each chunk: retrieve strong regs context -> ask the LLM
    for ch in chunks[:60]:  # cap for speed/safety
        pairs  = db.similarity_search_with_relevance_scores(ch.page_content, k=k)
        strong = [d for d, s in pairs if s >= min_rel][:4]

        if not strong:
            unclear += 1
            continue

        reg_context = "\n\n---\n\n".join(
            f"[{d.metadata.get('source_file','?')} | p.{d.metadata.get('page','?')} | {d.metadata.get('group','?')}]\n{d.page_content}"
            for d in strong
        )
        citations.extend([
            f"{d.metadata.get('source_file','?')} | page {d.metadata.get('page','?')} | group {d.metadata.get('group','?')}"
            for d in strong
        ])

        prompt = AUDIT_PROMPT.format(
            reg_context=reg_context,
            policy_chunk=ch.page_content[:3000]
        )
        raw = llm.predict(prompt)
        data = safe_json(raw)

        v = (data.get("verdict") or "unclear").strip().lower()
        if v == "compliant":
            compliant += 1
        elif v == "non-compliant":
            non_compliant += 1
        else:
            unclear += 1

        # Post-process each violation (no regex), preserve page fallback
        for item in data.get("violations", []):
            item.setdefault("page", ch.metadata.get("page", "Not specified"))
            fix_section_no_regex(item, strong)
            violations.append(item)

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