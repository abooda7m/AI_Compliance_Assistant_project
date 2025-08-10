import os, json
from typing import List, Tuple
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_chroma import Chroma
from langchain.prompts import ChatPromptTemplate
from app.utils_files import load_and_chunk

# Use same path/model/collection as your QA chain
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db", "regs")
COLLECTION  = "langchain"                 # or "regs" if you re-ingested with that
EMBED_MODEL = "text-embedding-3-large"

AUDIT_PROMPT = ChatPromptTemplate.from_template(
"""You are a regulatory compliance assistant specialized in SDAIA regulations.

Using only the provided regulation context, assess the user policy chunk.
If any non-compliance is found, return violations with:
- Document (use the regulation file name)
- Page (if available)
- Section/title (or summary)
- Explanation (what and why)
Also provide an overall verdict: compliant or not.

Return JSON:
{{
  "verdict": "compliant|non-compliant|unclear",
  "violations": [
    {{
      "document": "...",
      "page": "...",
      "section": "...",
      "regulation_citation": "file | page | group",
      "explanation": "..."
    }}
  ]
}}

# Regulation context
{reg_context}

# User policy chunk
{policy_chunk}
"""
)

def build_regs_retriever():
    emb = OpenAIEmbeddings(model=EMBED_MODEL)
    db  = Chroma(persist_directory=CHROMA_PATH, collection_name=COLLECTION, embedding_function=emb)
    return db.as_retriever(search_kwargs={"k": 4})

def audit_uploaded_file(path: str) -> Tuple[float, List[dict], List[str]]:
    retriever = build_regs_retriever()
    llm = ChatOpenAI(model_name="gpt-4")

    chunks = load_and_chunk(path, chunk_size=800, overlap=100)
    violations = []
    used_citations = []
    compliant_chunks, assessed_chunks = 0, 0

    for ch in chunks[:60]:  # cap for latency
        assessed_chunks += 1
        regs = retriever.invoke(ch.page_content)
        reg_context = "\n\n---\n\n".join(
            f"[{d.metadata.get('source_file','?')} | p.{d.metadata.get('page','?')} | {d.metadata.get('group','?')}]\n{d.page_content}"
            for d in regs
        )
        used_citations.extend([
            f"{d.metadata.get('source_file','?')} | page {d.metadata.get('page','?')} | group {d.metadata.get('group','?')}"
            for d in regs
        ])

        msg = AUDIT_PROMPT.format(reg_context=reg_context, policy_chunk=ch.page_content[:3000])
        raw = llm.predict(msg)
        try:
            data = json.loads(raw)
        except Exception:
            data = {"verdict": "unclear", "violations": []}

        verdict = data.get("verdict","unclear")
        if verdict == "compliant":
            compliant_chunks += 1
        for v in data.get("violations", []):
            v.setdefault("page", ch.metadata.get("page","Not specified"))
            violations.append(v)

    # naive score: percent of chunks marked compliant
    score = round(100.0 * compliant_chunks / assessed_chunks, 2) if assessed_chunks else 0.0
    # dedupe citations
    used_citations = list(dict.fromkeys(used_citations))
    return score, violations, used_citations