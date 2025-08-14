import os
from dotenv import load_dotenv

# Modern imports
from langchain_community.document_loaders import (
    TextLoader, UnstructuredFileLoader, PyPDFLoader
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

load_dotenv()

# ── Paths (project-relative) ────────────────────────────────────────────────
# This file lives in backend/app/, so BASE_DIR is backend/
BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR   = os.path.join(BASE_DIR, "data", "regs")          # put your PDFs/TXTs here
PERSIST_DIR = os.path.join(BASE_DIR, "chroma_db", "regs")    # backend/chroma_db/regs
COLLECTION  = "langchain"  # or "regs" if you want a custom name; just be consistent

# ── Loader helper ───────────────────────────────────────────────────────────
def load_and_split(path: str):
    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        loader = PyPDFLoader(path)                     # preserves page metadata
    elif ext in {".docx", ".doc"}:
        loader = UnstructuredFileLoader(path)          # good for Word files
    else:
        loader = TextLoader(path, encoding="utf-8")    # .txt and others

    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=100)
    return splitter.split_documents(docs)

# ── Main ingestion ──────────────────────────────────────────────────────────
def main():
    os.makedirs(PERSIST_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    # Ensure you’re using the same model here and at query time
    embeddings = OpenAIEmbeddings(model="text-embedding-3-large")

    # Explicit collection name for consistency
    db = Chroma(
        persist_directory=PERSIST_DIR,
        collection_name=COLLECTION,
        embedding_function=embeddings,
    )

    total_chunks = 0
    for fname in sorted(os.listdir(DATA_DIR)):
        fullpath = os.path.join(DATA_DIR, fname)
        if not os.path.isfile(fullpath):
            continue

        print(f"Processing: {fname}")
        chunks = load_and_split(fullpath)

        # Attach metadata expected by your app
        for c in chunks:
            c.metadata.setdefault("page", c.metadata.get("page", "N/A"))
            c.metadata["source_file"] = fname
            c.metadata["group"]       = "Sdaia"

        db.add_documents(chunks)
        total_chunks += len(chunks)


    print(f" Ingestion complete. Added {total_chunks} chunks.")
    print("Persist dir:", PERSIST_DIR)
    print("Collection :", COLLECTION)

if __name__ == "__main__":
    main()