# backend/app/routers/upload.py
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models_upload import UploadResponse
from app.utils_files import save_upload
import os

router = APIRouter()


def _safe_page_count(saved_path: str) -> int | None:
    """Return page count for PDFs only; never decode text."""
    try:
        if saved_path.lower().endswith(".pdf"):
            # Count pages via PyPDFLoader (already used in the project)
            from langchain_community.document_loaders import PyPDFLoader
            pages = PyPDFLoader(saved_path).load()  # one Document per page
            return len(pages)
    except Exception:
        pass
    return None


@router.post("/upload", response_model=UploadResponse)
async def upload(file: UploadFile = File(...)):
    """
    Accepts any allowed file and stores it as bytes. No decoding at upload time.
    Returns file_id (saved basename), original filename, and optional page count for PDFs.
    """
    try:
        raw: bytes = await file.read()          # <-- bytes only; do NOT .decode(...)
        if not raw:
            raise HTTPException(status_code=400, detail="Empty file.")
    finally:
        await file.close()

    try:
        saved_path = save_upload(file.filename, raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {e!s}")

    file_id = os.path.basename(saved_path)
    pages = _safe_page_count(saved_path)

    return UploadResponse(file_id=file_id, filename=file.filename, pages=pages)
