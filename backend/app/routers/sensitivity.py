from fastapi import APIRouter, HTTPException, Query
from app.models_upload import SensitivityReport, SensitivityFinding
from app.utils_files import load_and_chunk
from app.sensitivity_rules import find_matches
from app.sensitivity_llm import judge_snippet

router = APIRouter()

@router.get("/sensitivity", response_model=SensitivityReport)
def check_sensitivity(file_id: str = Query(...)):
    # Resolve path
    import os
    UPLOADS = os.path.abspath(os.path.join(os.path.dirname(__file__), "../uploads/tmp"))
    path = os.path.join(UPLOADS, file_id)
    if not os.path.exists(path):
        raise HTTPException(404, "File not found. Upload first.")

    # Chunk
    chunks = load_and_chunk(path, chunk_size=800, overlap=100)
    all_findings = []
    labels = []

    for ch in chunks[:50]:  # cap for latency; adjust as needed
        text = ch.page_content
        # rules
        findings = find_matches(text)
        for f in findings:
            all_findings.append(SensitivityFinding(
                type=f["type"], value=f["value"], start=f["start"], end=f["end"],
                page=ch.metadata.get("page"), severity=f["severity"]
            ))
        # llm
        verdict = judge_snippet(text)
        labels.append(verdict.get("label","Not Sensitive"))

    is_sensitive = any(lbl == "Sensitive" for lbl in labels) or len(all_findings) > 0
    summary = "Sensitive indicators found." if is_sensitive else "No sensitive indicators detected."
    return SensitivityReport(is_sensitive=is_sensitive, summary=summary, findings=all_findings)