# app/routers/db_audit.py
# path: backend/app/routers/db_audit.py
from __future__ import annotations

import base64
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query

from app.schemas.db import DBFacts
from app.schemas.db_audit import DBCheckResult, DBAuditReport  # <-- ADDED DBAuditReport
from app.db_audit_eval import run_db_audit
from app.db_collector import collect_db_facts
router = APIRouter()


def _resolve_dsn(dsn: Optional[str], dsn_base64: Optional[str]) -> str:
    if dsn_base64:
        try:
            return base64.b64decode(dsn_base64).decode("utf-8")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 in dsn_base64.")
    if dsn:
        return dsn
    raise HTTPException(
        status_code=400,
        detail="Missing DSN. Pass ?dsn=... (URL-encoded) or ?dsn_base64=...",
    )


@router.get("/db/facts", response_model=DBFacts, tags=["db-compliance"])
def db_facts(
    dsn: Optional[str] = Query(
        default=None,
        description=(
            "Per-request DB DSN. Example: "
            "mysql://user:p%40ss%23word@127.0.0.1:3306/mysql "
            "(URL-encode special characters)."
        ),
    ),
    dsn_base64: Optional[str] = Query(
        default=None,
        description="Base64-encoded DSN (avoids URL-encoding issues).",
    ),
):
    """
    Return raw, read-only DB facts. DSN is REQUIRED per request (no .env fallback).
    """
    dsn_effective = _resolve_dsn(dsn, dsn_base64)
    return collect_db_facts(dsn_effective)


@router.get("/db/audit", response_model=DBAuditReport, tags=["db-compliance"])  # <-- CHANGED response_model
def db_audit(
    authority: Optional[str] = Query(default="NCA", description="Must be NCA for DB audits"),
    dsn: Optional[str] = Query(
        default=None,
        description=(
            "Per-request DB DSN. Example: "
            "mysql://user:p%40ss%23word@127.0.0.1:3306/mysql "
            "(URL-encode special characters)."
        ),
    ),
    dsn_base64: Optional[str] = Query(
        default=None,
        description="Base64-encoded DSN (avoids URL-encoding issues).",
    ),
):
    """
    NCA-only DB audit. DSN is REQUIRED per request (no .env fallback).
    Retrieval in the evaluator is hard-filtered to authority='NCA'.
    """
    if authority and authority.upper() != "NCA":
        raise HTTPException(status_code=400, detail="DB audits are restricted to NCA.")

    dsn_effective = _resolve_dsn(dsn, dsn_base64)
    checks, summary = run_db_audit(dsn=dsn_effective)  # returns (checks, summary)
    return DBAuditReport(checks=checks, summary=summary)
