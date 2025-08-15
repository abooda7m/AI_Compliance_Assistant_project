import os
from pathlib import Path
from typing import List, Tuple

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, UnstructuredFileLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
load_dotenv()

# This file lives under app/, so BASE_DIR points to the backend root.
BASE_DIR      = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR      = os.path.join(BASE_DIR, "data", "regs")
PERSIST_DIR   = os.path.join(BASE_DIR, "chroma_db", "regs")
COLLECTION    = "langchain"
EMBED_MODEL   = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHUNK_SIZE    = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
GROUP_DEFAULT = os.getenv("DOC_GROUP", "Sdaia")

SUPPORTED_EXTS = {".pdf", ".docx", ".doc", ".txt"}


def _loader_for(path: str):
    ext = Path(path).suffix.lower()
    if ext == ".pdf":
        return PyPDFLoader(path)
    if ext in {".docx", ".doc"}:
        return UnstructuredFileLoader(path)
    return TextLoader(path, encoding="utf-8")


def _load_docs_with_len(path: str) -> Tuple[List, int]:
    loader = _loader_for(path)
    docs = loader.load()
    total_len = sum(len(getattr(d, "page_content", "") or "") for d in docs)
    return docs, total_len


def _split_docs(docs: List):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
    )
    return splitter.split_documents(docs)


def _ensure_metadata(chunks: List, src_path: str, group: str):
    src_base = os.path.basename(src_path)
    abs_path = os.path.abspath(src_path)
    for c in chunks:
        # standardize page info if present
        c.metadata.setdefault("page", c.metadata.get("page", "N/A"))
        if "page_label" in c.metadata:
            c.metadata["page_label"] = c.metadata["page_label"]
        # add common fields
        c.metadata["source_file"] = src_base
        c.metadata["source_path"] = abs_path
        c.metadata["group"] = group


def main() -> None:
    # Ensure directories exist
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(PERSIST_DIR, exist_ok=True)

    # Embeddings (must match query-time model)
    embeddings = OpenAIEmbeddings(model=EMBED_MODEL)

    # Persistent Chroma collection
    db = Chroma(
        persist_directory=PERSIST_DIR,
        collection_name=COLLECTION,
        embedding_function=embeddings,
    )

    total_chunks = 0
    processed_files = 0
    low_text_files: List[str] = []

    # Collect candidate files
    try:
        entries = sorted(os.listdir(DATA_DIR))
    except FileNotFoundError:
        print(f"[ERR] Data folder not found: {DATA_DIR}")
        return

    files = [
        os.path.join(DATA_DIR, f)
        for f in entries
        if Path(f).suffix.lower() in SUPPORTED_EXTS
    ]

    if not files:
        print(f"[WARN] No input files found in {DATA_DIR} ({', '.join(sorted(SUPPORTED_EXTS))})")
        return

    # Ingest all files
    for fullpath in files:
        if not os.path.exists(fullpath):
            print(f"[WARN] Skipping missing file: {fullpath}")
            continue

        docs, total_len = _load_docs_with_len(fullpath)
        if total_len < 200:
            low_text_files.append(os.path.basename(fullpath))
        chunks = _split_docs(docs)
        _ensure_metadata(chunks, fullpath, GROUP_DEFAULT)

        if chunks:
            db.add_documents(chunks)
            added = len(chunks)
            total_chunks += added
            processed_files += 1
            print(f"[+] {os.path.basename(fullpath)} → {added} chunks")
        else:
            print(f"[WARN] No chunks produced for {os.path.basename(fullpath)}")

    # Persist and summarize
    try:
        db.persist()
    except Exception:
        # Some versions persist automatically; ignore if not supported.
        pass

    print("\n── Ingestion complete ─────────────────────────────")
    print(f" Files processed : {processed_files}")
    print(f" Chunks added    : {total_chunks}")
    print(f" Persist dir     : {PERSIST_DIR}")
    print(f" Collection      : {COLLECTION}")
    print(f" Embed model     : {EMBED_MODEL}")
    if low_text_files:
        print(" [NOTE] These files had very little text and may require OCR:")
        for f in low_text_files:
            print(f"   - {f}")


if __name__ == "__main__":
    main()