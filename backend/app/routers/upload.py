# backend/app/routers/upload.py
import hashlib
import os
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends

from app.supa import supa, supa_as_user
from app.deps_auth import get_auth  # returns (user_id, org_id, token)
from app.storage import build_storage_path, upload_bytes, STORAGE_BUCKET

router = APIRouter(tags=["upload"])

def _sha256_bytes(data: bytes) -> str:
    h = hashlib.sha256()
    h.update(data)
    return h.hexdigest()

def _exists_in_storage(service_client, storage_url: str) -> bool:
    raw = (storage_url or "").lstrip("/")
    if not raw:
        return False
    if "/" in raw:
        bucket, key = raw.split("/", 1)
    else:
        bucket, key = STORAGE_BUCKET, raw
    try:
        service_client.storage.from_(bucket).create_signed_url(key, 60)
        return True
    except Exception:
        return False

def _validate_company_belongs_to_user(user_client, org_id: str, user_id: str, company_id: Optional[str]) -> Optional[str]:
    if not company_id:
        return None
    try:
        row = (
            user_client.table("companies")
            .select("id")
            .eq("org_id", org_id)
            .eq("created_by", user_id)
            .eq("id", company_id)
            .maybe_single()
            .execute()
            .data
        )
        return row["id"] if row else None
    except Exception:
        return None

@router.post("/upload")
def upload_file(
    file: UploadFile = File(...),
    company_id: Optional[str] = Form(default=None),
    auth = Depends(get_auth),
):
    """
    Idempotent per (org_id, uploaded_by, sha256).
    If a duplicate exists but its Storage object is missing, re-upload and update the row (heal).
    """
    user_id, org_id, token = auth
    service = supa()               # service client for Storage
    user_db = supa_as_user(token)  # user-scoped client for DB (RLS on)

    # read bytes
    try:
        content = file.file.read()
    finally:
        try: file.file.close()
        except Exception: pass
    if not content:
        raise HTTPException(status_code=400, detail="Empty file.")

    sha256 = _sha256_bytes(content)
    filename = file.filename or "upload.bin"
    content_type = file.content_type or "application/octet-stream"

    # validate company ownership (drop invalid)
    company_id = _validate_company_belongs_to_user(user_db, org_id, user_id, company_id)

    # check for existing by idempotency key
    existing = (
        user_db.table("documents")
        .select("id, filename, storage_url, created_at")
        .eq("org_id", org_id)
        .eq("uploaded_by", user_id)
        .eq("sha256", sha256)
        .maybe_single()
        .execute()
        .data
    )

    if existing:
        # if object exists, return current row
        if _exists_in_storage(service, existing.get("storage_url", "")):
            return {"file_id": existing["id"], "filename": existing.get("filename") or filename, "pages": None, "healed": False}

        # heal: re-upload and update storage_url on the same row
        storage_path = build_storage_path(org_id, filename, sha256)
        storage_url = upload_bytes(service, STORAGE_BUCKET, content, content_type, storage_path)
        user_db.table("documents").update(
            {"storage_url": storage_url, "filename": filename, "local_path": None}
        ).eq("id", existing["id"]).execute()
        return {"file_id": existing["id"], "filename": filename, "pages": None, "healed": True}

    # no existing → upload and insert
    storage_path = build_storage_path(org_id, filename, sha256)
    storage_url = upload_bytes(service, STORAGE_BUCKET, content, content_type, storage_path)

    to_insert = {
        "org_id": org_id,
        "company_id": company_id,
        "uploaded_by": user_id,
        "filename": filename,
        "content_type": content_type,
        "storage_url": storage_url,
        "local_path": None,
        "num_pages": None,
        "sha256": sha256,
    }
    ins = user_db.table("documents").insert(to_insert).execute()
    if not ins.data or not isinstance(ins.data, list) or not ins.data[0].get("id"):
        # fallback fetch if insert returns no row
        fetched = (
            user_db.table("documents")
            .select("id")
            .eq("org_id", org_id)
            .eq("uploaded_by", user_id)
            .eq("sha256", sha256)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not fetched:
            raise HTTPException(status_code=500, detail="Upload succeeded but could not find inserted row.")
        return {"file_id": fetched[0]["id"], "filename": filename, "pages": None, "healed": False}

    return {"file_id": ins.data[0]["id"], "filename": filename, "pages": None, "healed": False}