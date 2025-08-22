# backend/app/chains.py
import os
from typing import List, Tuple

from dotenv import load_dotenv
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI

load_dotenv()

CHROMA_PATH = os.getenv(
    "CHROMA_PATH",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/regs")),
)
CHROMA_COLLECTION = os.getenv("CHROMA_COLLECTION", "ksa_regs")
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4")


def _format_context(docs_scores: List[Tuple[object, float]]) -> str:
    blocks = []
    for doc, _score in docs_scores:
        meta = doc.metadata or {}
        header = f"[{meta.get('authority','?')}] {meta.get('file','?')} | page {meta.get('page','?')} | section: {meta.get('section','General')}"
        blocks.append(header + "\n" + doc.page_content.strip())
    return "\n\n---\n\n".join(blocks)


def _citations(docs_scores: List[Tuple[object, float]]) -> List[str]:
    cites = []
    for doc, _score in docs_scores:
        m = doc.metadata or {}
        cites.append(f"{m.get('file','?')} | page {m.get('page','?')} | authority {m.get('authority','?')}")
    # dedupe while preserving order
    seen = set()
    out: List[str] = []
    for c in cites:
        if c not in seen:
            out.append(c)
            seen.add(c)
    return out


def make_manual_qa(k: int = 4, min_score: float = 0.0):
    """
    Returns a callable(question:str)->(answer:str|None, citations:List[str])
    Vector-search over configured Chroma collection, then answer strictly from context.
    """
    embeddings = OpenAIEmbeddings(model=EMBED_MODEL)
    vs = Chroma(
        collection_name=CHROMA_COLLECTION,
        persist_directory=CHROMA_PATH,
        embedding_function=embeddings,
    )
    llm = ChatOpenAI(model=CHAT_MODEL, temperature=0)

    def run_qa(question: str):
        results = vs.similarity_search_with_score(question, k=k)
        if not results:
            return None, []
        # Optional score filter (distance; lower is better). Only apply if your index stores scores comparably.
        if min_score > 0:
            filtered = []
            for d, s in results:
                try:
                    if s <= min_score:
                        filtered.append((d, s))
                except Exception:
                    filtered.append((d, s))
            results = filtered or results

        context = _format_context(results)
        system = (
            "You are a compliance QA assistant. Answer ONLY from the given context. "
            "Quote exact terms and include section/article numbers when present. "
            "If the answer is not in the context, reply exactly: \"I don't have enough context to answer.\""
        )
        prompt = f"{system}\n\nContext:\n{context}\n\nQuestion:\n{question}\n\nAnswer:"
        answer = llm.predict(prompt)
        if "I don't have enough context to answer." in answer:
            return None, []
        return answer, _citations(results)

    return run_qa
