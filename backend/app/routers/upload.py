from fastapi import APIRouter, UploadFile, File, HTTPException
from app.models_upload import UploadResponse
from app.utils_files import save_upload
import os

router = APIRouter()

@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    try:
        data = await file.read()
        saved_path = save_upload(data, file.filename)
        # pages optional (only for PDFs); keep it simple for now
        return UploadResponse(file_id=os.path.basename(saved_path), filename=file.filename)
    except ValueError as ve:
        raise HTTPException(400, str(ve))
    except Exception:
        raise HTTPException(500, "Failed to upload file")