import os, uuid, io
from typing import Tuple, List
from pydantic import BaseModel
from langchain_community.document_loaders import PyPDFLoader, UnstructuredFileLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads/tmp"))
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXT = {".pdf", ".txt", ".docx", ".doc"}

def save_upload(bytes_data: bytes, filename: str) -> str:
    _, ext = os.path.splitext(filename)
    ext = ext.lower()
    if ext not in ALLOWED_EXT:
        raise ValueError(f"Unsupported file type: {ext} (not in {', '.join(ALLOWED_EXT)})")
    file_id = str(uuid.uuid4())
    path = os.path.join(UPLOAD_DIR, f"{file_id}{ext}")
    with open(path, "wb") as f:
        f.write(bytes_data)
    return path

def load_and_chunk(path: str, chunk_size=500, overlap=100):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        loader = PyPDFLoader(path)
    elif ext in {".docx", ".doc"}:
        loader = UnstructuredFileLoader(path)
    else:
        loader = TextLoader(path, encoding="utf-8")

    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=chunk_size, chunk_overlap=overlap)
    return splitter.split_documents(docs)