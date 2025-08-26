# backend/app/chains.py
import os
import math
from typing import List, Tuple

from dotenv import load_dotenv

# Try new chroma package first, fall back to community wrapper
try:
    from langchain_chroma import Chroma  # type: ignore
    _CHROMA_USES_COLLECTION = True
except Exception:  # pragma: no cover
    from langchain_community.vectorstores import Chroma  # type: ignore
    _CHROMA_USES_COLLECTION = False

from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.prompts import ChatPromptTemplate

load_dotenv()

# Paths and config via env, with sane defaults
CHROMA_PATH = os.getenv(
    "CHROMA_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/regs")),
)
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "ksa_regs")
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4")

PROMPT_TEMPLATE = """You are a compliance QA assistant. Use ONLY the context to answer.
If something is not clearly supported by the context, say: "I couldn’t find that in the provided documents."

When you state a fact, append the supporting source header copied verbatim from the context
after that bullet, in this exact format: (source file: '...', page: <n>, group: '...').

Example bullet format:
 - The controller must do X. (source file: 'SomeLaw.pdf', page: 12, group: 'Sdaia')

Context:
{context}

Question:
{question}

Answering rules:
- Write concise bullet points.
- Use the exact legal terms and article or section numbers that appear in the context.
- After each bullet, include one or more source headers copied from the relevant block(s).
- Do not invent sources, pages, dates, penalties or definitions that aren’t in the context.
- If the context is insufficient, explicitly say you cannot find it in the provided documents.
- Do not add a References section; citations are inline as shown.
"""

def _header_from_meta(meta: dict) -> str:
    """Builds a uniform header string from mixed metadata keys."""
    authority = meta.get("authority") or meta.get("group") or "?"
    file_ = meta.get("file") or meta.get("source_file") or "?"
    page = meta.get("page", "?")
    section = meta.get("section") or meta.get("article") or "General"
    # Header text is intentionally simple so it can be copied verbatim into answers
    return f"[{authority}] {file_} | page {page} | section: {section}"

def _format_context(docs_scores: List[Tuple[object, float]]) -> str:
    blocks = []
    for doc, _score in docs_scores:
        meta = doc.metadata or {}
        header = _header_from_meta(meta)
        blocks.append(header + "\n" + doc.page_content.strip())
    return "\n\n---\n\n".join(blocks)

def _citations(docs_scores: List[Tuple[object, float]]) -> List[str]:
    cites = []
    for doc, _score in docs_scores:
        m = doc.metadata or {}
        file_ = m.get("file") or m.get("source_file") or "?"
        page = m.get("page", "?")
        group = m.get("authority") or m.get("group") or "?"
        cites.append(f"{file_} | page {page} | group {group}")
    # Dedupe preserving order
    seen = set()
    out: List[str] = []
    for c in cites:
        if c not in seen:
            out.append(c)
            seen.add(c)
    return out

def make_manual_qa(default_k: int = 5, default_threshold: float = 0.5):
    """
    Returns run_qa(question: str, k: int = default_k, threshold: float = default_threshold)
      -> (answer: str | None, citations: List[str])

    Retrieval, strict context answering, inline source format.
    """
    embeddings = OpenAIEmbeddings(model=EMBED_MODEL)

    # Build vector store, support both constructors
    if _CHROMA_USES_COLLECTION:
        vs = Chroma(
            collection_name=CHROMA_COLLECTION,
            persist_directory=CHROMA_PATH,
            embedding_function=embeddings,
        )
    else:
        vs = Chroma(
            persist_directory=CHROMA_PATH,
            embedding_function=embeddings,
            collection_name=CHROMA_COLLECTION,
        )

    llm = ChatOpenAI(model=CHAT_MODEL, temperature=0)
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)

    def _search(question: str, k: int):
        """
        Try relevance scores first, fall back to similarity-with-score.
        Normalize score to 'higher is better' in [0,1] when possible.
        """
        try:
            # returns List[Tuple[Document, score]] where score is 0..1 relevance
            return vs.similarity_search_with_relevance_scores(question, k=k), "relevance"
        except Exception:
            results = vs.similarity_search_with_score(question, k=k)
            # Chroma distance is usually smaller better. Convert to pseudo relevance.
            converted = []
            for doc, dist in results:
                try:
                    rel = 1 / (1 + float(dist))
                except Exception:
                    rel = 0.0
                converted.append((doc, rel))
            return converted, "distance"

    def run_qa(question: str, k: int = default_k, threshold: float = default_threshold):
        results, _mode = _search(question, k=k)
        if not results:
            return None, []

        # Guard on top score
        top_score = results[0][1]
        # Round up a bit like your prior code, then compare
        if (math.ceil(top_score * 20) / 20) < threshold:
            return None, []

        context = _format_context(results)
        prompt = prompt_template.format(context=context, question=question)
        answer = llm.predict(prompt)

        # If the model says it cannot find it, return None for easy handling upstream
        cannot = "I couldn’t find that in the provided documents." in answer
        if cannot:
            return None, []

        return answer, _citations(results)

    return run_qa
