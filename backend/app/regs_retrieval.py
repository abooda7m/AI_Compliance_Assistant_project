# app/services/regs_retrieval.py
"""
Chroma retrieval (self-contained) using the SAME stack as QA:
- Preferred: LangChain Chroma VectorStore + OpenAIEmbeddings
- Fallback: raw chromadb client

Optional: fact/topic-aware rerank with an absolute min_score threshold to drop distant hits.

Public API:
    fetch_clauses(
        query: str,
        k: int,
        preferred_sources: Optional[List[str]] = None,
        group: Optional[str] = GROUP_DEFAULT,
        facts: Optional[CompanyFacts] = None,
        topic_terms: Optional[List[str]] = None,
        rerank_top: Optional[int] = None,
        min_score: Optional[float] = None,
    ) -> Dict[str, List[str]]

Returns:
    {"docs": [text, ...], "citations": ["File.pdf | page N | group G", ...]}
"""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.company import CompanyFacts  # for optional reranking

# ----------------------------
# Constants (matches your spec)
# ----------------------------
BASE_DIR      = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PERSIST_DIR   = os.path.join(BASE_DIR, "chroma_db", "regs")
COLLECTION    = os.getenv("CHROMA_COLLECTION", "langchain")  # overridable for raw chromadb
EMBED_MODEL   = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
GROUP_DEFAULT = os.getenv("DOC_GROUP", "Sdaia")

# ---------------------------------------------------------
# Preferred path: LangChain VectorStore + OpenAIEmbeddings
# ---------------------------------------------------------
try:
    from langchain_community.vectorstores import Chroma as LCChroma  # type: ignore
    from langchain_openai import OpenAIEmbeddings  # type: ignore
except Exception:  # pragma: no cover
    LCChroma = None  # type: ignore
    OpenAIEmbeddings = None  # type: ignore


def _get_vectorstore_or_none():
    """Open persisted LangChain Chroma at PERSIST_DIR with OpenAIEmbeddings(EMBED_MODEL)."""
    if LCChroma is None or OpenAIEmbeddings is None:
        return None
    try:
        embeddings = OpenAIEmbeddings(model=EMBED_MODEL)
        return LCChroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)
    except Exception:
        return None


def _lc_search_once(
    *,
    db,  # LCChroma instance
    query: str,
    k: int,
    filter_: Optional[Dict[str, Any]] = None
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    One vector search via LangChain Chroma, with optional metadata filter.
    Returns list of (text, metadata).
    """
    try:
        pairs = db.similarity_search_with_relevance_scores(query, k=k, filter=filter_ or {})
    except Exception:
        return []
    out: List[Tuple[str, Dict[str, Any]]] = []
    for doc, _score in pairs:
        text = (doc.page_content or "").strip()
        if not text:
            continue
        out.append((text, doc.metadata or {}))
    return out


# ---------------------------------------------------------
# Fallback path: raw chromadb client
# ---------------------------------------------------------
try:
    import chromadb  # type: ignore
except Exception:  # pragma: no cover
    chromadb = None  # type: ignore


def _get_chromadb_collection_or_none():
    """Open a raw chromadb collection at PERSIST_DIR with name COLLECTION."""
    if chromadb is None:
        return None
    try:
        client = chromadb.PersistentClient(path=PERSIST_DIR)
        return client.get_collection(name=COLLECTION)
    except Exception:
        return None


def _cdb_search_once(
    *,
    col,  # chromadb Collection
    query: str,
    k: int,
    where: Optional[Dict[str, Any]] = None
) -> List[Tuple[str, Dict[str, Any]]]:
    """
    One vector/text search via raw chromadb Collection, with optional 'where' filter.
    Returns list of (text, metadata).
    """
    try:
        res = col.query(
            query_texts=[query],
            n_results=k,
            where=where or {},
            include=["documents", "metadatas"],
        )
    except Exception:
        return []
    docs = (res.get("documents") or [[]])[0]
    metas = (res.get("metadatas") or [[]])[0]
    out: List[Tuple[str, Dict[str, Any]]] = []
    for i in range(min(len(docs), len(metas))):
        txt = (docs[i] or "").strip()
        if not txt:
            continue
        out.append((txt, metas[i] or {}))
    return out


# ---------------------------------------------------------
# Utilities
# ---------------------------------------------------------
def _fmt_citation(meta: Dict[str, Any]) -> str:
    """
    Build "File | page N | group G" style source marker we rely on downstream.
    We try several common metadata keys to be robust to different ingesters.
    """
    src = (
        meta.get("source_file")
        or meta.get("source_path")
        or meta.get("source")
        or meta.get("filename")
        or meta.get("document_id")
        or "unknown"
    )
    page = meta.get("page", meta.get("page_number", "n/a"))
    group = meta.get("group", meta.get("doc_group", GROUP_DEFAULT))
    return f"{src} | page {page} | group {group}"


def _add_many(
    *,
    acc_docs: List[str],
    acc_cits: List[str],
    seen: set[Tuple[str, str]],
    items: List[Tuple[str, Dict[str, Any]]],
    k: int
):
    """Append (text, citation) into accumulators with de-duplication and cap k."""
    for text, meta in items:
        cit = _fmt_citation(meta)
        key = (text, cit)
        if key in seen:
            continue
        seen.add(key)
        acc_docs.append(text)
        acc_cits.append(cit)
        if len(acc_docs) >= k:
            break


# ---------------------------------------------------------
# OPTIONAL fact/topic-aware rerank + threshold
# ---------------------------------------------------------
_WORD = re.compile(r"[A-Za-z][A-Za-z\-]+")

def _extract_fact_terms(facts: Optional[CompanyFacts]) -> List[str]:
    """Flatten CompanyFacts into a deduped list of lowercase tokens (>=3 chars)."""
    if not facts:
        return []
    terms: List[str] = []
    def add_list(lst):
        for x in (lst or []):
            x = str(x).strip()
            if x:
                terms.append(x.lower())
    if getattr(facts, "company_name", None):
        terms.append(facts.company_name.lower())
    add_list(getattr(facts, "activities", []))
    add_list(getattr(facts, "purposes", []))
    add_list(getattr(facts, "data_categories", []))
    add_list(getattr(facts, "data_subjects", []))
    add_list(getattr(facts, "processors", []))
    add_list(getattr(facts, "recipients", []))
    cb = getattr(facts, "cross_border", None)
    if cb:
        terms.append(cb.lower())
    add_list(getattr(facts, "security_measures", []))

    # tokenize & dedupe
    words: List[str] = []
    for t in terms:
        words.extend(_WORD.findall(t))
    out: List[str] = []
    for w in words:
        w = w.lower()
        if len(w) >= 3 and w not in out:
            out.append(w)
    return out


def _score_text_for_facts(text: str, fact_terms: List[str], topic_terms: List[str]) -> float:
    """Simple keyword overlap scorer with topic boost."""
    body = (text or "").lower()
    score = 0.0
    for t in fact_terms:
        if t in body:
            score += 1.0
    for kw in (topic_terms or []):
        if kw in body:
            score += 2.0  # topic terms weigh more
    return score


def _apply_factaware_rerank(
    docs: List[str],
    citations: List[str],
    facts: Optional[CompanyFacts],
    topic_terms: Optional[List[str]],
    keep_top: int,
    min_score: Optional[float] = None,
) -> Tuple[List[str], List[str]]:
    """
    Stable sort by fact/topic score; keep top-N; optionally DROP items below min_score.
    If filtering drops everything, we return an empty set so the caller can fallback/broaden.
    """
    if not docs or not citations:
        return docs, citations
    fact_terms = _extract_fact_terms(facts)
    topic_terms = [t.lower() for t in (topic_terms or [])]
    if not fact_terms and not topic_terms and min_score is None:
        return docs, citations

    scored = [(_score_text_for_facts(docs[i], fact_terms, topic_terms), i) for i in range(len(docs))]

    # Absolute threshold first (drop very distant hits)
    if min_score is not None:
        scored = [(s, i) for (s, i) in scored if s >= min_score]
        if not scored:
            return [], []  # let caller broaden

    scored.sort(key=lambda x: (-x[0], x[1]))  # desc by score, then original index
    keep_idx = [i for (_s, i) in scored[: min(keep_top, len(scored))]]
    new_docs = [docs[i] for i in keep_idx]
    new_cits = [citations[i] for i in keep_idx]
    return new_docs, new_cits


# ---------------------------------------------------------
# Public API
# ---------------------------------------------------------
def fetch_clauses(
    *,
    query: str,
    k: int,
    preferred_sources: Optional[List[str]] = None,
    group: Optional[str] = GROUP_DEFAULT,
    # Optional rerank controls
    facts: Optional[CompanyFacts] = None,
    topic_terms: Optional[List[str]] = None,
    rerank_top: Optional[int] = None,
    min_score: Optional[float] = None,
) -> Dict[str, List[str]]:
    """
    Retrieve up to k clause texts + citations, preferring exact filenames in preferred_sources.
    Tries LangChain Chroma first; falls back to raw chromadb.

    Rerank controls (all optional):
      - facts: CompanyFacts to derive fact terms
      - topic_terms: policy topic keywords to boost
      - rerank_top: keep top-N after rerank (defaults to k)
      - min_score: absolute threshold; drop hits with score < min_score (e.g., 1.0)
    """
    if k <= 0:
        return {"docs": [], "citations": []}

    db = _get_vectorstore_or_none()
    use_lc = db is not None

    acc_docs: List[str] = []
    acc_cits: List[str] = []
    seen: set[Tuple[str, str]] = set()

    def search_once(filter_or_where: Dict[str, Any]) -> List[Tuple[str, Dict[str, Any]]]:
        if use_lc:
            # IMPORTANT: pass filter_ (with underscore) to match _lc_search_once signature
            return _lc_search_once(db=db, query=query, k=k, filter_=filter_or_where)
        col = _get_chromadb_collection_or_none()
        if col is None:
            return []
        return _cdb_search_once(col=col, query=query, k=k, where=filter_or_where)

    # 1) Try each preferred filename (exact match on 'source_file', fallback to 'source_path')
    if preferred_sources:
        for fname in preferred_sources:
            if len(acc_docs) >= k:
                break
            if group:
                _add_many(
                    acc_docs=acc_docs, acc_cits=acc_cits, seen=seen,
                    items=search_once({"group": group, "source_file": fname}), k=k
                )
                if len(acc_docs) < k:
                    _add_many(
                        acc_docs=acc_docs, acc_cits=acc_cits, seen=seen,
                        items=search_once({"group": group, "source_path": fname}), k=k
                    )
            if len(acc_docs) < k:
                _add_many(
                    acc_docs=acc_docs, acc_cits=acc_cits, seen=seen,
                    items=search_once({"source_file": fname}), k=k
                )
            if len(acc_docs) < k:
                _add_many(
                    acc_docs=acc_docs, acc_cits=acc_cits, seen=seen,
                    items=search_once({"source_path": fname}), k=k
                )

    # 2) If still short, try by group only
    if len(acc_docs) < k and group:
        _add_many(
            acc_docs=acc_docs, acc_cits=acc_cits, seen=seen,
            items=search_once({"group": group}), k=k
        )

    # 3) Final backfill: no filter
    if len(acc_docs) < k:
        _add_many(
            acc_docs=acc_docs, acc_cits=acc_cits, seen=seen,
            items=search_once({}), k=k
        )

    # 4) Optional rerank + threshold
    keep_n = rerank_top or k
    acc_docs, acc_cits = _apply_factaware_rerank(
        docs=acc_docs,
        citations=acc_cits,
        facts=facts,
        topic_terms=topic_terms,
        keep_top=keep_n,
        min_score=min_score,   # apply absolute drop if set
    )

    return {"docs": acc_docs[:k], "citations": acc_cits[:k]}
