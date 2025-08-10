# backend/app/test_chroma.py

import os
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

# 1) Load your OpenAI key (expects backend/.env)
load_dotenv(os.path.abspath(os.path.join(os.path.dirname(__file__), "../.env")))

# 2) Point to your persisted Chroma folder (backend/chroma_db/regs)
CHROMA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/regs"))

# IMPORTANT: Your chroma_inspect.py showed the collection is named "langchain"
COLLECTION_NAME = "langchain"   # change only if you re-ingested with another name
EMBED_MODEL     = "text-embedding-3-large"  # must match the model used at ingest

def main():
    print("Using DB at:", CHROMA_PATH)
    if not os.path.exists(CHROMA_PATH):
        print("Path does not exist. Check CHROMA_PATH.")
        return

    # 3) Init embeddings and vector store
    emb = OpenAIEmbeddings(model=EMBED_MODEL)
    try:
        db = Chroma(
            persist_directory=CHROMA_PATH,
            collection_name=COLLECTION_NAME,
            embedding_function=emb,
        )
    except Exception as e:
        print("Failed to open Chroma collection:", e)
        return

    # 4) Run a similarity search (or the scored variant)
    query = "What are the requirements for obtaining user consent under the data protection law?"
    print("Query:", query)

    try:
        # If you want scores, use similarity_search_with_relevance_scores
        pairs = db.similarity_search_with_relevance_scores(query, k=4)
    except Exception as e:
        print("Query failed:", e)
        print("If you see an HNSW/index error, re-ingest with the SAME chromadb/langchain versions and SAME embedding model.")
        return

    if not pairs:
        print("Retrieved 0 documents.")
        return

    # 5) Print results
    print("\nTop relevant chunks:\n")
    for i, (doc, score) in enumerate(pairs, 1):
        source = doc.metadata.get("source_file", "Unknown Source")
        page   = doc.metadata.get("page",        "Unknown Page")
        group  = doc.metadata.get("group",       "Unknown Group")
        text   = doc.page_content.replace("\n", " ")

        print(f"{i}) score={float(score):.4f} | {source} | page {page} | group {group}")
        print(text[:600] + ("..." if len(text) > 600 else ""))
        print()

if __name__ == "__main__":
    main()