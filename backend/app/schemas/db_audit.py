# app/schemas/db_audit.py
from __future__ import annotations

from typing import List, Optional, Literal, Dict, Any
from pydantic import BaseModel, Field

Verdict = Literal["PASS", "FAIL", "MANUAL"]
Priority = Literal["High", "Medium", "Low"]


class DBCheckResult(BaseModel):
    """
    One structured result for a single NCA database control.
    """
    control_id: str
    section: Optional[str] = None
    requirement: str
    verdict: Verdict
    evidence: Dict[str, Any] = Field(default_factory=dict)
    remediation: str
    priority: Priority = "Medium"
    citations: List[str] = Field(default_factory=list)

    # Optional label for convenience (e.g., "TLS in transit", "Password hashing")
    topic: Optional[str] = None


# --- ADDED: report wrapper for (checks, summary) ---
class DBAuditReport(BaseModel):
    checks: List[DBCheckResult]
    summary: str
