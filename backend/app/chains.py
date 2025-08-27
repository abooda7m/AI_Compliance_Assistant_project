# backend/app/chains.py
import os
import math
import re
from typing import List, Tuple

from dotenv import load_dotenv
from app.config.sdaia_sources import SDAIA_SOURCE_FILES

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

# Models for pre-retrieval optimization (rewrite & translation)
REWRITE_MODEL = os.getenv("OPENAI_REWRITE_MODEL", CHAT_MODEL)
TRANSLATE_MODEL = os.getenv("OPENAI_TRANSLATE_MODEL", REWRITE_MODEL)

PROMPT_TEMPLATE = """
You are a compliance QA assistant. Use ONLY the context to answer compliance/legal questions.
If something is not clearly supported by the context, say: "I couldn’t find that in the provided documents."

Special rule for simple/basic greetings or small talk:
- If the user asks something like "Hi", "Hello", "How are you?", or "What do you do?",
  respond briefly and politely without using citations.

Inline citation rule (VERY IMPORTANT):
- After EVERY bullet or factual statement, append an inline citation in EXACTLY this format:
  (file: '<file name>', page: <n>, section: '<section>', group: '<authority>')
- Use values that appear in the context headers (file / page / section / group).
- Do NOT place citations in a separate References section; no end-of-answer citation lists.

Answering + language rules:
- {answer_lang_instructions}
- Write concise bullet points for compliance/legal answers.
- If the question is very basic, answer shortly and DO NOT include citations.
- Use the exact legal terms and article/section numbers that appear in the context.
- Do not invent sources, pages, dates, penalties, or definitions that aren’t in the context.
- If the context is insufficient, explicitly say: "I couldn’t find that in the provided documents."
- Make the answer easy to read and visually clear for the eye (use short bullets, spacing, and simple symbols like ✅ or ❌ if helpful).

Context:
{context}

Question:
{question}

Answer:
"""

REWRITE_PROMPT = """
You are a query optimizer for legal/compliance retrieval.
Goal: produce ONE short **English** query that is highly retrieval-friendly.

The user question may be in Arabic or English. Follow these rules:
- Keep ONLY essential legal terms: law name/abbrev (e.g., PDPL, NCA ECC), article/section numbers, topic keywords
  (e.g., cross-border transfers, breach notification, data minimization).
- Remove greetings, filler, and noise.
- DO NOT pick or mention any specific file to search; do not output a filename.
- Use these known source titles ONLY as hints to choose correct law names/phrases (do not include them verbatim):
{sources_hint}

User question:
{question}

Optimized English query (one line only, no extra words):
"""

TRANSLATE_FULL_TO_EN_PROMPT = """
You are a precise legal translator. Translate the following question into clear English,
preserving legal terms, article/section numbers, and meaning exactly. Output ONLY the translation.

Text:
{text}

English:
"""

# Language instructions injected into the main prompt
ANSWER_LANG_AR = (
    "Answer in Modern Standard Arabic (Arabic text), but keep inline citations EXACTLY in the English key-value format."
)
ANSWER_LANG_EN = (
    "Answer in English, and keep inline citations EXACTLY in the English key-value format."
)


def _header_from_meta(meta: dict) -> str:
    """Builds a uniform header string from mixed metadata keys."""
    authority = meta.get("authority") or meta.get("group") or "?"
    file_ = meta.get("file") or meta.get("source_file") or "?"
    page = meta.get("page", "?")
    section = meta.get("section") or meta.get("article") or "General"
    # Header formatted so the model can copy values into (file,page,section,group)
    return f"file: '{file_}' | page: {page} | section: '{section}' | group: '{authority}'"


def _format_context(docs_scores: List[Tuple[object, float]]) -> str:
    blocks = []
    for doc, _score in docs_scores:
        meta = doc.metadata or {}
        header = _header_from_meta(meta)
        blocks.append(header + "\n" + doc.page_content.strip())
    return "\n\n---\n\n".join(blocks)


def _citations(docs_scores: List[Tuple[object, float]]) -> List[str]:
    """
    Programmatic citations list (UI may ignore since inline citations are enforced in the answer).
    """
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


def _is_arabic(s: str) -> bool:
    """Rough check: does the string contain Arabic characters?"""
    return bool(re.search(r"[\u0600-\u06FF]", s))


def _sources_hint(max_items: int = 100) -> str:
    """
    Build a short bulleted hint list from SDAIA_SOURCE_FILES to steer the optimizer.
    This is ONLY for guidance; we do not filter retrieval or output filenames.
    """
    items = SDAIA_SOURCE_FILES[:max_items]
    return "\n".join(f"- {name}" for name in items)


def _rewrite_query(llm, question: str, sources_hint: str) -> str:
    """Use LLM to produce a concise, retrieval-optimized EN query (guided by known titles)."""
    try:
        prompt = ChatPromptTemplate.from_template(REWRITE_PROMPT)
        rw = prompt.format(question=question, sources_hint=sources_hint)
        out = llm.predict(rw).strip()
        # Defensive cleanup: strip quotes / trailing punctuation
        out = out.strip().strip('"').strip("'").strip()
        return out if out else question
    except Exception:
        return question


def _translate_full_to_english(llm, text: str) -> str:
    """Translate the full question to accurate English for query + answering prompt."""
    try:
        prompt = ChatPromptTemplate.from_template(TRANSLATE_FULL_TO_EN_PROMPT)
        rw = prompt.format(text=text)
        out = llm.predict(rw).strip()
        return out if out else text
    except Exception:
        return text


def make_manual_qa(default_k: int = 5, default_threshold: float = 0):
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

    # LLMs
    llm = ChatOpenAI(model=CHAT_MODEL, temperature=0)
    llm_rewrite = ChatOpenAI(model=REWRITE_MODEL, temperature=0)
    llm_translate = ChatOpenAI(model=TRANSLATE_MODEL, temperature=0)

    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    sources_hint = _sources_hint()

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
        # Detect language and set output instructions
        arabic = _is_arabic(question)
        answer_lang_instructions = ANSWER_LANG_AR if arabic else ANSWER_LANG_EN

        # If Arabic: translate FULL question to English for both rewrite+answering prompt
        question_for_llms = (
            _translate_full_to_english(llm_translate, question) if arabic else question
        )

        # Rewrite the (English) question into a concise retrieval query,
        # guided by known SDAIA source titles (as hints only).
        effective_q = _rewrite_query(llm_rewrite, question_for_llms, sources_hint)

        # Retrieve with optimized EN query (NO metadata filters)
        results, _mode = _search(effective_q, k=k)
        if not results:
            return None, []

        # Build context and ask the LLM; pass the EN question to the prompt
        context = _format_context(results)
        prompt = prompt_template.format(
            context=context,
            question=question_for_llms,  # English if Arabic input; original English otherwise
            answer_lang_instructions=answer_lang_instructions,
        )
        answer = llm.predict(prompt)

        # If the model says it cannot find it, return None for easy handling upstream
        cannot = "I couldn’t find that in the provided documents." in answer
        if cannot:
            return None, []

        return answer, _citations(results)

    return run_qa
