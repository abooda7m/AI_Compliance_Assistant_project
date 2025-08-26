# app/storage.py
import os
import time
import uuid
import tempfile
from contextlib import contextmanager
from typing import Optional, Tuple

from fastapi import HTTPException
from supabase import Client
from storage3.exceptions import StorageApiError

STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "uploads")
UPLOAD_CACHE_DIR = os.getenv("UPLOAD_CACHE_DIR", "uploads_cache")
# If true, we never persist files locally and always download to a temp file when needed.
DISABLE_PERSISTENT_CACHE = os.getenv("DISABLE_PERSISTENT_CACHE", "true").lower() in {"1", "true", "yes"}


def build_storage_path(org_id: str, filename: str, sha256: str) -> str:
    safe = (filename or "").replace("\\", "/").split("/")[-1]
    return f"{org_id}/{uuid.uuid4()}_{int(time.time())}_{sha256[:12]}_{safe}"


def _split_storage_url(storage_url: str) -> Tuple[str, str]:
    """
    Accepts either "bucket/path/to/file" or "path/to/file".
    Returns (bucket, path). Defaults to STORAGE_BUCKET if bucket missing.
    """
    storage_url = (storage_url or "").lstrip("/")
    if not storage_url:
        return STORAGE_BUCKET, ""
    if "/" in storage_url:
        bkt, path = storage_url.split("/", 1)
        # If first segment equals our bucket, keep; otherwise treat whole thing as path in default bucket
        if bkt == STORAGE_BUCKET:
            return bkt, path
        # Some older rows may have stored the raw key only – fallback:
        return STORAGE_BUCKET, storage_url
    # No slash → treat as key only
    return STORAGE_BUCKET, storage_url


def upload_bytes(client: Client, bucket: str, data: bytes, content_type: str, storage_path: str) -> str:
    client.storage.from_(bucket).upload(
        storage_path,
        data,
        file_options={"content-type": content_type, "upsert": False},
    )
    # We store as "bucket/path" so ephemeral downloader can parse it.
    return f"{bucket}/{storage_path}"


def download_to_path(client: Client, bucket: str, storage_path: str, dest_path: str) -> str:
    try:
        data = client.storage.from_(bucket).download(storage_path)
    except StorageApiError as e:
        msg = getattr(e, "message", str(e))
        code = getattr(e, "code", None)
        if code == 404 or "not_found" in msg or "404" in msg:
            raise HTTPException(
                status_code=410,
                detail="File is missing in Supabase Storage (likely deleted). Please re-upload.",
            )
        raise
    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(data)
    return dest_path


@contextmanager
def ephemeral_document_path(client: Client, storage_url: str, *, filename_hint: Optional[str] = None):
    """
    Windows-safe temp file: download a Storage object to a real temp file, close it,
    yield the path, and remove it after use. Raises 410 if the object doesn't exist.
    """
    bucket, storage_path = _split_storage_url(storage_url)
    if not storage_path:
        raise HTTPException(status_code=400, detail="Invalid storage URL/key.")

    try:
        data = client.storage.from_(bucket).download(storage_path)
    except StorageApiError as e:
        msg = getattr(e, "message", str(e))
        code = getattr(e, "code", None)
        if code == 404 or "not_found" in msg or "404" in msg:
            # Orphaned DB row referencing a deleted Storage object
            raise HTTPException(
                status_code=410,
                detail="File is missing in Supabase Storage (likely deleted). Please re-upload.",
            )
        raise

    # best-effort suffix from original filename to aid some loaders
    suffix = ""
    if filename_hint and "." in filename_hint:
        suffix = "." + filename_hint.rsplit(".", 1)[-1].lower()

    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
            f.flush()
        # file is now closed → safe for docx2txt/pyPDF to reopen on Windows
        yield path
    finally:
        try:
            if os.path.exists(path):
                os.remove(path)
        except Exception:
            # best-effort cleanup; ignore if already deleted
            pass
