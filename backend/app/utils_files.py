# backend/app/utils_files.py
import os
import uuid
from typing import List

from langchain_community.document_loaders import PyPDFLoader, UnstructuredFileLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
try:
    # LangChain >= 0.2
    from langchain_core.documents import Document
except Exception:
    # Older LangChain fallback
    from langchain.docstore.document import Document

# Upload directory (relative to backend/)
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "tmp"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXT = {".pdf", ".txt", ".docx", ".doc"}


def save_upload(filename: str, bytes_data: bytes) -> str:
    """
    Save an uploaded file into UPLOAD_DIR with a unique, sanitized name.
    Returns absolute path to the saved file.
    """
    name = os.path.basename(filename).replace("/", "_").replace("\\", "_")
    unique = f"{uuid.uuid4().hex}_{name}"
    path = os.path.join(UPLOAD_DIR, unique)
    with open(path, "wb") as f:
        f.write(bytes_data)
    return path


def _read_text_safely(path: str) -> List[Document]:
    """
    Read a .txt file with robust encoding fallbacks for Arabic/Windows text.
    Order: utf-8 -> cp1256 -> windows-1252 -> latin-1 -> utf-8(ignore)
    """
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


def load_and_chunk(path: str, chunk_size: int = 500, overlap: int = 100):
    """
    Load a local document then split into text chunks for downstream processing.
    Returns a list[Document].
    """
    ext = os.path.splitext(path)[1].lower()

    if ext == ".pdf":
        loader = PyPDFLoader(path)
        docs = loader.load()
    elif ext in {".docx", ".doc"}:
        # Requires 'unstructured' deps at runtime; if missing it will raise
        loader = UnstructuredFileLoader(path)
        docs = loader.load()
    elif ext == ".txt":
        docs = _read_text_safely(path)
    else:
        # Best-effort generic text with utf-8 (ignore errors to avoid hard failures)
        try:
            loader = TextLoader(path, encoding="utf-8")
            docs = loader.load()
        except Exception:
            docs = _read_text_safely(path)

    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    return splitter.split_documents(docs)
