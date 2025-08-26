# backend/app/ingest_regs.py
"""
Ingest NCA and SDAIA regulatory docs into one Chroma collection with rich metadata.
- Collection: CHROMA_COLLECTION, default "ksa_regs"
- Persist dir: CHROMA_PATH, default backend/chroma_db/regs
- Data dir: backend/data/regs, supports subfolders "nca" and "sdaia", and flat files
Each chunk is tagged with: authority, domain, doc_type, file, page, lang, section,
plus compatibility fields: source_file, source_path, group.
Idempotent via stable content-hash IDs, delete-before-add.
"""

import os
import hashlib
from pathlib import Path
from typing import List, Tuple, Optional

from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader, UnstructuredFileLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma
try:
    from langchain_core.documents import Document
except Exception:
    from langchain.docstore.document import Document  # type: ignore

load_dotenv()

# Paths
BASE_DIR   = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR   = os.path.join(BASE_DIR, "data", "regs")
NCA_DIR    = os.path.join(DATA_DIR, "nca")
SDAIA_DIR  = os.path.join(DATA_DIR, "sdaia")

# Config, overridable via .env
PERSIST_DIR    = os.getenv("CHROMA_PATH", os.path.join(BASE_DIR, "chroma_db", "regs"))
COLLECTION     = os.getenv("CHROMA_COLLECTION", "ksa_regs")
EMBED_MODEL    = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-large")
CHUNK_SIZE     = int(os.getenv("INGEST_CHUNK_SIZE", "1000"))
CHUNK_OVERLAP  = int(os.getenv("INGEST_CHUNK_OVERLAP", "150"))
SUPPORTED_EXTS = {".pdf", ".txt", ".docx", ".doc"}

# ------------------------ loaders ------------------------

def _loader_for(path: str):
    ext = Path(path).suffix.lower()
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


def _load_docs(path: str) -> List[Document]:
    ext = Path(path).suffix.lower()
    if ext == ".txt":
        return _read_text_safely(path)
    return _loader_for(path).load()


def _split_docs(docs: List[Document]) -> List[Document]:
    splitter = RecursiveCharacterTextSplitter(chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP)
    return splitter.split_documents(docs)

# ------------------------ metadata helpers ------------------------

def _section_from(text: str) -> str:
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


def _ensure_compat_metadata(chunk: Document, src_path: str, authority: str) -> None:
    # normalize page
    if "page" not in chunk.metadata:
        chunk.metadata["page"] = chunk.metadata.get("page_label", "N/A")
    # add compatibility fields used by other modules
    chunk.metadata["source_file"] = os.path.basename(src_path)
    chunk.metadata["source_path"] = os.path.abspath(src_path)
    chunk.metadata["group"] = authority  # used by some prompts

# ------------------------ file iteration ------------------------

def _iter_files(root: str) -> List[str]:
    if not os.path.isdir(root):
        return []
    out: List[str] = []
    for enr, _, files in os.walk(root):
        for f in files:
            ext = Path(f).suffix.lower()
            if ext in SUPPORTED_EXTS:
                out.append(os.path.join(enr, f))
    return sorted(out)

def _iter_flat_files(root: str) -> List[str]:
    if not os.path.isdir(root):
        return []
    out: List[str] = []
    for f in sorted(os.listdir(root)):
        p = os.path.join(root, f)
        if os.path.isfile(p) and Path(f).suffix.lower() in SUPPORTED_EXTS:
            out.append(p)
    return out

# ------------------------ ingestion core ------------------------

def _ingest_file(vs: Chroma, fpath: str, authority: str, domain: str) -> Tuple[int, int, Optional[str]]:
    filename = os.path.basename(fpath)
    doc_type = _doc_type_from(filename)

    docs = _load_docs(fpath)
    chunks = _split_docs(docs)

    if not chunks:
        return 0, 0, filename

    texts: List[str] = []
    metadatas: List[dict] = []
    ids: List[str] = []

    for i, d in enumerate(chunks):
        page = d.metadata.get("page")
        section = _section_from(d.page_content)
        cid = _hash_id(authority, filename, page, i, d.page_content)

        _ensure_compat_metadata(d, fpath, authority)

        ids.append(cid)
        texts.append(d.page_content)
        metadatas.append(
            {
                "authority": authority,
                "domain": domain,
                "doc_type": doc_type,
                "file": filename,
                "page": page,
                "lang": "en",
                "section": section,
                # compatibility fields
                "source_file": d.metadata["source_file"],
                "source_path": d.metadata["source_path"],
                "group": d.metadata["group"],
            }
        )

    try:
        if ids:
            vs.delete(ids=ids)
    except Exception:
        pass

    vs.add_texts(texts=texts, metadatas=metadatas, ids=ids)
    return 1, len(texts), None


def _ingest_folder(vs: Chroma, folder: str, authority: str, domain: str) -> Tuple[int, int, List[str]]:
    files = _iter_files(folder)
    processed_files = 0
    total_chunks = 0
    low_text_files: List[str] = []

    for fpath in files:
        n_files, n_chunks, low = _ingest_file(vs, fpath, authority, domain)
        processed_files += n_files
        total_chunks += n_chunks
        if low:
            low_text_files.append(low)

    return processed_files, total_chunks, low_text_files

# ------------------------ main ------------------------

def main() -> None:
    os.makedirs(PERSIST_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    embeddings = OpenAIEmbeddings(model=EMBED_MODEL)
    vectorstore = Chroma(
        collection_name=COLLECTION,
        persist_directory=PERSIST_DIR,
        embedding_function=embeddings,
    )

    total_files = 0
    total_chunks = 0
    low_text_files: List[str] = []

    # Subfolder mode
    if os.path.isdir(NCA_DIR) or os.path.isdir(SDAIA_DIR):
        print("── Ingesting NCA ─────────────────────────────────")
        n_files, n_chunks, n_low = _ingest_folder(vectorstore, NCA_DIR, "NCA", "database_security")
        print(f"  Files: {n_files} , Chunks: {n_chunks}")
        total_files += n_files
        total_chunks += n_chunks
        low_text_files.extend(n_low)

        print("── Ingesting SDAIA ───────────────────────────────")
        s_files, s_chunks, s_low = _ingest_folder(vectorstore, SDAIA_DIR, "SDAIA", "privacy")
        print(f"  Files: {s_files} , Chunks: {s_chunks}")
        total_files += s_files
        total_chunks += s_chunks
        low_text_files.extend(s_low)

    # Flat files directly under data/regs
    flat_files = _iter_flat_files(DATA_DIR)
    if flat_files:
        print("── Ingesting flat files in data/regs ─────────────")
        for f in flat_files:
            # default authority for flat files, can be overridden by folder name hints
            authority = "SDAIA" if "sdaia" in f.lower() else "NCA" if "nca" in f.lower() else "SDAIA"
            domain = "privacy" if authority == "SDAIA" else "database_security"
            n_files, n_chunks, low = _ingest_file(vectorstore, f, authority, domain)
            print(f"  {os.path.basename(f)} , chunks {n_chunks}")
            total_files += n_files
            total_chunks += n_chunks
            if low:
                low_text_files.append(low)

    try:
        vectorstore.persist()
    except Exception:
        pass

    print("\n── Ingestion complete ─────────────────────────────")
    print(f" Persist dir   : {PERSIST_DIR}")
    print(f" Collection    : {COLLECTION}")
    print(f" Embed model   : {EMBED_MODEL}")
    print(f" Files         : {total_files}")
    print(f" Chunks        : {total_chunks}")
    if low_text_files:
        print(" [NOTE] These files had very little text and may require OCR:")
        for f in low_text_files:
            print(f"   - {f}")


if __name__ == "__main__":
    main()
