# backend/app/ingest_regs.py
import os
from dotenv import load_dotenv
from langchain.document_loaders import (
    TextLoader, UnstructuredFileLoader, PyPDFLoader )
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma


load_dotenv()

# ─── Configuration ────────────────────────────────────────────────────────────
DATA_DIR    = os.path.abspath(os.path.join(os.path.dirname(__file__), "C:/Users/alkho/Desktop/complaince project/backend/chroma_db/regs/SADAIA"))

PERSIST_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../chroma_db/regs"))

# ─── Helper to load & chunk a single .txt document ────────────────────────────
def load_and_split(path: str):
    ext = os.path.splitext(path)[1].lower()
    # PDF → gets real page numbers in metadata
    if ext == ".pdf":
        loader = PyPDFLoader(path)
    # DOCX → if you have Word files
    elif ext in {".docx", ".doc"}:
        loader = UnstructuredWordDocumentLoader(path)
    # Fallback for any stray .txt
    else:
        loader = TextLoader(path, encoding="utf-8")

    # Load yields one Document per source page (for PDF) or whole text (for TXT/DOCX)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    return splitter.split_documents(docs)

# ─── Main ingestion routine ───────────────────────────────────────────────────
def main():
    os.makedirs(PERSIST_DIR, exist_ok=True)
    embeddings  = OpenAIEmbeddings(model="text-embedding-3-large")
    vectorstore = Chroma(persist_directory=PERSIST_DIR, embedding_function=embeddings)

    for fname in sorted(os.listdir(DATA_DIR)):
        fullpath = os.path.join(DATA_DIR, fname)
        print(f"⏳ Processing {fname}…")
        chunks = load_and_split(fullpath)

        for chunk in chunks:
            # Preserve real page number (from PDF loader) or `None`
            # chunk.metadata["page"] is already set when using PyPDFLoader
            chunk.metadata["source_file"] = fname
            chunk.metadata["group"]       = "Sdaia"

        vectorstore.add_documents(chunks)

    vectorstore.persist()
    print("✅ Ingestion complete!")

if __name__ == "__main__":
    main()