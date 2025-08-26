# backend/app/routers/upload.py
import hashlib
import os
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

# Optional cloud stack
try:
    from fastapi import Depends
    from app.supa import supa
    from app.storage import build_storage_path, upload_bytes
    from app.deps_auth import get_auth  # returns (user_id, org_id, extra)
    _HAS_SUPA = True
except Exception:
    _HAS_SUPA = False

# Local utils
try:
    from app.models_upload import UploadResponse  # if you use pydantic model elsewhere
except Exception:
    UploadResponse = None  # type: ignore

from app.utils_files import save_upload

router = APIRouter(tags=["upload"])


def _safe_page_count(saved_path: str) -> Optional[int]:
    """Return page count for PDFs only, without decoding text."""
    try:
        if saved_path.lower().endswith(".pdf"):
            from langchain_community.document_loaders import PyPDFLoader
            pages = PyPDFLoader(saved_path).load()
            return len(pages)
    except Exception:
        pass
    return None


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    company_id: str | None = Form(None),
    auth = Depends(get_auth) if _HAS_SUPA else None,
):
    """
    Unified upload endpoint.
    - Cloud mode: requires Supabase deps and org auth, stores to object storage and DB.
    - Local mode: saves to disk via save_upload and returns a file_id (basename).
    Response: {"file_id": str, "filename": str, "pages": int|None}
    """
    # read bytes once
    content: bytes = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")
    digest = hashlib.sha256(content).hexdigest()
    filename = file.filename or "upload.bin"

    # Cloud mode
    if _HAS_SUPA and auth is not None:
        user_id, org_id, _ = auth
        if not org_id:
            raise HTTPException(status_code=500, detail="ORG_ID not set")

        client = supa()
        bucket = os.getenv("STORAGE_BUCKET", "uploads")

        # Idempotent per (org, user, sha256)
        existing = (
            client.table("documents")
            .select("id, filename, storage_url, company_id")
            .eq("org_id", org_id)
            .eq("uploaded_by", user_id)
            .eq("sha256", digest)
            .limit(1)
            .execute()
        )
        if existing.data:
            row = existing.data[0]
            return {"file_id": row["id"], "filename": row["filename"], "pages": None}

        # Validate company belongs to org, ignore if not
        if company_id:
            try:
                ok = (
                    client.table("companies")
                    .select("id")
                    .eq("org_id", org_id)
                    .eq("id", company_id)
                    .limit(1)
                    .execute()
                )
                if not ok.data:
                    company_id = None
            except Exception:
                company_id = None

        storage_path = build_storage_path(org_id, filename, digest)
        upload_bytes(
            client,
            bucket,
            content,
            file.content_type or "application/octet-stream",
            storage_path,
        )

        ins = client.table("documents").insert(
            {
                "org_id": org_id,
                "company_id": company_id,
                "uploaded_by": user_id,
                "filename": filename,
                "content_type": file.content_type or "application/octet-stream",
                "storage_url": f"{bucket}/{storage_path}",
                "local_path": None,
                "num_pages": None,  # optionally set via async extractor later
                "sha256": digest,
            }
        ).execute()

        data = ins.data or {}
        if isinstance(data, list):
            data = data[0] if data else {}

        doc_id = data.get("id")
        if not doc_id:
            # fallback fetch by hash
            fetch = (
                client.table("documents")
                .select("id")
                .eq("org_id", org_id)
                .eq("uploaded_by", user_id)
                .eq("sha256", digest)
                .limit(1)
                .execute()
            )
            if fetch.data:
                doc_id = fetch.data[0]["id"]

        if not doc_id:
            raise HTTPException(status_code=500, detail="Insert succeeded but no id returned.")

        return {"file_id": doc_id, "filename": filename, "pages": None}

    # Local mode
    try:
        saved_path = save_upload(filename, content)  # accepts (filename, bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save: {e!s}")

    file_id = os.path.basename(saved_path)
    pages = _safe_page_count(saved_path)
    return {"file_id": file_id, "filename": filename, "pages": pages}
