# backend/app/utils_files.py
import os
import uuid
from typing import List, Tuple, Union

from langchain_community.document_loaders import (
    PyPDFLoader,
    UnstructuredFileLoader,
    TextLoader,
)
# Docx2txt is optional; fall back to Unstructured if missing
try:
    from langchain_community.document_loaders import Docx2txtLoader  # type: ignore
    _HAS_DOCX2TXT = True
except Exception:  # pragma: no cover
    Docx2txtLoader = None  # type: ignore
    _HAS_DOCX2TXT = False

from langchain_text_splitters import RecursiveCharacterTextSplitter

try:
    # LangChain >= 0.2
    from langchain_core.documents import Document
except Exception:  # pragma: no cover
    # Older LangChain fallback
    from langchain.docstore.document import Document  # type: ignore

# Upload directory (relative to backend/)
UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "tmp"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXT = {".pdf", ".txt", ".docx", ".doc"}


def _read_text_safely(path: str) -> List[Document]:
    """
    Read a .txt file with robust encoding fallbacks for Arabic and Windows text.
    Order: utf-8, cp1256, windows-1252, latin-1, utf-8(ignore).
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


def _sanitize_filename(name: str) -> str:
    name = os.path.basename(name).replace("/", "_").replace("\\", "_")
    if not name:
        name = "upload"
    return name


def save_upload(a: Union[str, bytes, bytearray], b: Union[str, bytes, bytearray]) -> str:
    """
    Save an uploaded file into UPLOAD_DIR with a unique, sanitized name.
    Supports BOTH call styles to avoid breaking callers:
      - save_upload(filename: str, bytes_data: bytes)
      - save_upload(bytes_data: bytes, filename: str)

    Returns the absolute path to the saved file.
    """
    if isinstance(a, (bytes, bytearray)) and isinstance(b, str):
        bytes_data = a
        filename = b
    elif isinstance(a, str) and isinstance(b, (bytes, bytearray)):
        filename = a
        bytes_data = b
    else:
        raise TypeError("save_upload expects (filename:str, bytes:bytes) or (bytes:bytes, filename:str)")

    name = _sanitize_filename(filename)
    _, ext = os.path.splitext(name)
    ext = ext.lower()
    if ext not in ALLOWED_EXT:
        # keep extension check strict to avoid surprises at loaders
        raise ValueError(f"Unsupported file type: {ext}")

    unique = f"{uuid.uuid4().hex}_{name}"
    path = os.path.join(UPLOAD_DIR, unique)
    with open(path, "wb") as f:
        f.write(bytes_data)
    return path


def pick_loader(path: str):
    """
    Choose a loader by extension, preferring Docx2txt for .docx if available.
    Falls back to UnstructuredFileLoader for .doc and .docx when needed.
    """
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        return PyPDFLoader(path)
    if ext == ".docx":
        if _HAS_DOCX2TXT:
            return Docx2txtLoader(path)  # type: ignore
        return UnstructuredFileLoader(path)
    if ext == ".doc":
        return UnstructuredFileLoader(path)
    # default text loader, utf-8
    return TextLoader(path, encoding="utf-8")


def load_and_chunk(path: str, chunk_size: int = 500, overlap: int = 100) -> List[Document]:
    """
    Load a local document then split into text chunks.
    Returns List[Document] with chunked page_content and merged metadata.
    """
    ext = os.path.splitext(path)[1].lower()

    # Special-case robust TXT reading
    if ext == ".txt":
        docs = _read_text_safely(path)
    else:
        try:
            loader = pick_loader(path)
            docs = loader.load()
        except Exception:
            # Last-resort, attempt robust text read
            docs = _read_text_safely(path)

    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    return splitter.split_documents(docs)


def chunk_with_loader(path: str, chunk_size: int = 800, overlap: int = 100) -> List[Document]:
    """
    Explicit loader path, used by analyzers or diskless modes.
    """
    loader = pick_loader(path)
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    return splitter.split_documents(docs)
