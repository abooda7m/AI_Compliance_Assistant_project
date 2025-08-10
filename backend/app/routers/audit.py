# audit.py 
from fastapi import APIRouter, HTTPException, Query
from app.models_upload import ComplianceReport
from app.audit_policy import audit_uploaded_file
import os

router = APIRouter()

@router.get("/audit", response_model=ComplianceReport)
def audit(file_id: str = Query(...)):
    UPLOADS = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads/tmp"))
    path = os.path.join(UPLOADS, file_id)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found. Upload first.")

    score, violations, citations = audit_uploaded_file(path)
    coverage_summary = f"Assessed policy chunks against SDAIA regs. Overall compliance: {score}%."

    return ComplianceReport(
        compliance_score=score,
        coverage_summary=coverage_summary,
        violations=violations,
        used_context=citations
    )