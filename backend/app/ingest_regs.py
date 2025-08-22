# backend/app/ingest_regs.py
"""
Ingest NCA and SDAIA regulatory docs into a single Chroma collection with rich metadata.
- Collection: CHROMA_COLLECTION (default: "ksa_regs")
- Persist dir: CHROMA_PATH (default: backend/chroma_db/regs)
Each chunk is tagged with: authority (NCA|SDAIA), domain, doc_type, file, page, lang, section.
Idempotent via stable content-hash IDs (delete-before-add).
"""

import os
import hashlib
from typing import List, Tuple, Optional

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, UnstructuredFileLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
try:
    from langchain_core.documents import Document
except Exception:
    from langchain.docstore.document import Document

load_dotenv()

# Paths
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(BASE_DIR, "data", "regs")
NCA_DIR = os.path.join(DATA_DIR, "nca")
SDAIA_DIR = os.path.join(DATA_DIR, "sdaia")

# Config (overridable via .env)
PERSIST_DIR = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "chroma_db", "regs"))
COLLECTION = os.getenv("CHROMA_COLLECTION", "ksa_regs")
EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHUNK_SIZE = int(os.getenv("INGEST_CHUNK_SIZE", "2200"))
CHUNK_OVERLAP = int(os.getenv("INGEST_CHUNK_OVERLAP", "300"))

ALLOWED_EXTS = {".pdf", ".txt", ".docx", ".doc"}


def _loader_for(path: str):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return PyPDFLoader(path)
    if ext in {".docx", ".doc"}:
        return UnstructuredFileLoader(path)
    return TextLoader(path, encoding="utf-8")


def _read_text_safely(path: str) -> List[Document]:
    with open(path, "rb") as f:
        raw = f.read()

    text = None
    used = None
    for enc in ("utf-8", "cp1256", "windows-1252", "latin-1"):
        try:
            text = raw.decode(enc)
            used = enc
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        text = raw.decode("utf-8", errors="ignore")
        used = "utf-8(ignore)"

    return [Document(page_content=text, metadata={"source": path, "encoding": used})]


def _section_from(text: str) -> str:
    """Cheap first-line-as-section heuristic to aid citations."""
    text = (text or "").strip()
    if not text:
        return "General"
    head = text.splitlines()[0][:200]
    keys = ("Article", "Section", "Clause", "Control", "Requirement", "Chapter")
    if any(k.lower() in head.lower() for k in keys):
        return head
    return head if len(head) >= 10 else "General"


def _doc_type_from(filename: str) -> str:
    name = filename.lower()
    if "standard" in name:
        return "standard"
    if "policy" in name:
        return "policy"
    if "law" in name:
        return "law"
    if "regulation" in name or "regulations" in name or "exec" in name:
        return "regulation"
    if "guide" in name or "guideline" in name:
        return "guide"
    return "document"


def _hash_id(authority: str, filename: str, page: Optional[int], idx: int, content: str) -> str:
    h = hashlib.sha256()
    base = f"{authority}|{filename}|{page if page is not None else 'NA'}|{idx}|".encode("utf-8")
    h.update(base)
    h.update(content.encode("utf-8"))
    return h.hexdigest()


def _iter_files(root: str) -> List[str]:
    if not os.path.isdir(root):
        return []
    out: List[str] = []
    for enr, _, files in os.walk(root):
        for f in files:
            ext = os.path.splitext(f)[1].lower()
            if ext in ALLOWED_EXTS:
                out.append(os.path.join(enr, f))
    return sorted(out)


def _load_and_split(path: str):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".txt":
        docs = _read_text_safely(path)
    else:
        loader = _loader_for(path)
        docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    return splitter.split_documents(docs)


def _ingest_folder(vs: Chroma, folder: str, authority: str) -> Tuple[int, int, List[str]]:
    files = _iter_files(folder)
    total_chunks = 0
    processed_files = 0
    low_text_files: List[str] = []

    for fpath in files:
        filename = os.path.basename(fpath)
        doc_type = _doc_type_from(filename)
        docs = _load_and_split(fpath)
        if not docs:
            low_text_files.append(filename)
            continue

        metadatas = []
        ids = []
        texts = []
        for i, d in enumerate(docs):
            page = d.metadata.get("page")
            section = _section_from(d.page_content)
            cid = _hash_id(authority, filename, page, i, d.page_content)
            ids.append(cid)
            texts.append(d.page_content)
            metadatas.append(
                {
                    "authority": authority,
                    "domain": "database_security" if authority == "NCA" else "privacy",
                    "doc_type": doc_type,
                    "file": filename,
                    "page": page,
                    "lang": "en",
                    "section": section,
                }
            )

        try:
            if ids:
                vs.delete(ids=ids)
        except Exception:
            pass

        if texts:
            vs.add_texts(texts=texts, metadatas=metadatas, ids=ids)
            total_chunks += len(texts)
            processed_files += 1

    return processed_files, total_chunks, low_text_files


def main():
    os.makedirs(PERSIST_DIR, exist_ok=True)
    embeddings = OpenAIEmbeddings(model=EMBED_MODEL)
    vectorstore = Chroma(
        collection_name=COLLECTION,
        persist_directory=PERSIST_DIR,
        embedding_function=embeddings,
    )

    print("── Ingesting NCA ─────────────────────────────────")
    n_files, n_chunks, n_low = _ingest_folder(vectorstore, NCA_DIR, "NCA")
    print(f"  Files: {n_files} | Chunks: {n_chunks}")

    print("── Ingesting SDAIA ───────────────────────────────")
    s_files, s_chunks, s_low = _ingest_folder(vectorstore, SDAIA_DIR, "SDAIA")
    print(f"  Files: {s_files} | Chunks: {s_chunks}")

    low_text_files = [*n_low, *s_low]

    print("\n── Ingestion complete ─────────────────────────────")
    print(f" Persist dir     : {PERSIST_DIR}")
    print(f" Collection      : {COLLECTION}")
    print(f" Embed model     : {EMBED_MODEL}")
    if low_text_files:
        print(" [NOTE] These files had very little text and may require OCR:")
        for f in low_text_files:
            print(f"   - {f}")

    try:
        vectorstore.persist()
    except Exception:
        pass


if __name__ == "__main__":
    main()
