# backend/app/chains.py

import os
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.prompts import ChatPromptTemplate

# 1️⃣ Load environment variables (adjust path if .env lives elsewhere)
load_dotenv()

# 2️⃣ Paths & prompt template
CHROMA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/chroma_db/regs"))

PROMPT_TEMPLATE = """You are a regulatory compliance assistant. Answer ONLY using the context.
Context:
{context}

---
Instructions:
- Do NOT use outside knowledge.
- Include inline citations for each claim in the format (source_file p.page group).
Question: {question}

Answer:"""

def make_manual_qa():
    """
    Returns a function run_qa(question: str) -> (answer: str | None, sources: List[str])
    which:
      1. Retrieves top-k documents with relevance scores.
      2. If top score < threshold, returns (None, []).
      3. Otherwise, builds a context from the docs, prompts GPT-4, and returns its answer + citations.
    """
    # Initialize embedding function and vector store
    embedding_fn = OpenAIEmbeddings( model="text-embedding-3-large")
    db           = Chroma(persist_directory=CHROMA_PATH, embedding_function=embedding_fn)

    # Prepare prompt template and LLM
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    model           = ChatOpenAI( model_name="gpt-4")

    def run_qa(question: str, k: int = 5, threshold: float = 0.5):
        # 1) Retrieve top-k docs + their relevance scores
        results = db.similarity_search_with_relevance_scores(question, k=k)

        # 2) Bail out if no doc is above the threshold
        # if not results or results[0][1] < threshold:
        #     return None, []

        # 3) Build the context string from the retrieved chunks
        context = "\n\n---\n\n".join(
            f"[Source: {doc.metadata.get('source_file','?')} | p.{doc.metadata.get('page','?')} | {doc.metadata.get('group','?')}]"
            f"\n{doc.page_content}"
            for doc, _ in results
            )

        # 4) Format the chat prompt
        prompt = prompt_template.format(context=context, question=question)

        # 5) Call GPT-4
        answer = model.predict(prompt)

        # 6) Extract and format citation metadata
        sources = [
            f"{doc.metadata.get('source_file','?')} | page {doc.metadata.get('page','?')} | group {doc.metadata.get('group','?')}"
            for doc, _ in results
        ]

        return answer, sources

    return run_qa