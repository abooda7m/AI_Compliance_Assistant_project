# app/routers/audit.py
from fastapi import APIRouter, HTTPException, Query
import os
from app.models_upload import ComplianceReport   # your pydantic model
from app.audit_policy import audit_uploaded_file
from app.utils_files import UPLOAD_DIR

router = APIRouter()

@router.get("/audit", response_model=ComplianceReport)
def audit(file_id: str = Query(...)):
    path = os.path.join(UPLOAD_DIR, file_id)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found. Upload first.")

    result = audit_uploaded_file(path)

    breakdown = result["breakdown"]
    summary = (
        f"Assessed {breakdown['assessed']} chunks "
        f"(compliant {breakdown['compliant']}, "
        f"non-compliant {breakdown['non_compliant']}, "
        f"unclear {breakdown['unclear']}). "
        f"Overall compliance: {result['score']}%."
    )

    return ComplianceReport(
        compliance_score=result["score"],
        coverage_summary=summary,
        violations=result["violations"],
        used_context=result["citations"],
    )