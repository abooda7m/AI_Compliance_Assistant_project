# app/routers/reports.py
from __future__ import annotations

from fastapi import APIRouter, Query, Depends
from typing import Optional

from app.deps_auth import get_auth          # -> returns (user_id, org_id, token)
from app.supa import supa_as_user, supa     # user client (RLS) + service client
from app.storage import STORAGE_BUCKET

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/documents")
def list_documents(
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth = Depends(get_auth),
):
    """
    Recent documents for the current user (within org).
    Adds `available` flag by checking if the Storage object still exists.
    Hides rows whose Storage object no longer exists.
    """
    user_id, org_id, token = auth
    cu = supa_as_user(token)   # DB queries with RLS
    cs = supa()                # service client for Storage metadata check

    q = (
        cu.table("documents")
        .select("id, filename, created_at, company_id, storage_url")
        .eq("org_id", org_id)
        .eq("uploaded_by", user_id)  # users see their own uploads
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = q.data or []

    items = []
    for r in rows:
        raw = (r.get("storage_url") or "").lstrip("/")
        if "/" in raw:
            bucket, key = raw.split("/", 1)
        else:
            bucket, key = STORAGE_BUCKET, raw

        ok = True
        try:
            if key:
                # cheap existence check; throws if missing
                cs.storage.from_(bucket).create_signed_url(key, 60)
            else:
                ok = False
        except Exception:
            ok = False

        #  Option A: skip rows missing in Storage
        if not ok:
            continue

        items.append({
            "id": r["id"],
            "filename": r["filename"],
            "created_at": r["created_at"],
            "company_id": r.get("company_id"),
            "available": ok,  # will be True for all returned rows
        })

    return {"items": items, "limit": limit, "offset": offset}

@router.get("/sensitivity")
def list_sensitivity(
    document_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth = Depends(get_auth),
):
    """
    List sensitivity reports for the current org (optionally filter by document_id).
    Response matches FE expectation: id, document_id, is_sensitive, summary, findings, created_at.
    """
    _, org_id, token = auth
    c = supa_as_user(token)
    q = (
        c.table("sensitivity_reports")
        .select("id, document_id, is_sensitive, summary, findings, created_at")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
    )
    if document_id:
        q = q.eq("document_id", document_id)
    q = q.range(offset, offset + limit - 1).execute()
    return {"items": q.data or [], "limit": limit, "offset": offset}


@router.get("/audit")
def list_audit(
    document_id: Optional[str] = None,
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    auth = Depends(get_auth),
):
    """
    List audit reports for the current org (optionally filter by document_id).
    Response matches FE expectation: id, document_id, compliance_score, coverage_summary,
    violations, used_context, created_at.
    """
    _, org_id, token = auth
    c = supa_as_user(token)
    q = (
        c.table("audit_reports")
        .select("id, document_id, compliance_score, coverage_summary, violations, used_context, created_at")
        .eq("org_id", org_id)
        .order("created_at", desc=True)
    )
    if document_id:
        q = q.eq("document_id", document_id)
    q = q.range(offset, offset + limit - 1).execute()
    return {"items": q.data or [], "limit": limit, "offset": offset}