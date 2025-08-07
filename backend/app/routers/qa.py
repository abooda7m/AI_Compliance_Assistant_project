# # backend/app/routers/qa.py

from fastapi import APIRouter, HTTPException
from app.models import QARequest, QAResponse
from app.chains import make_manual_qa

router = APIRouter()
run_qa = make_manual_qa()

@router.post("/qa", response_model=QAResponse)
def simple_qa(req: QARequest):
    """
    Handles a QA request by running manual retrieval + GPT-4.
    Returns 404 if no document passes the relevance threshold.
    """
    answer, citations = run_qa(req.question)
    if answer is None:
        raise HTTPException(status_code=404, detail="No relevant documents found.")
    return QAResponse(answer=answer, citations=citations)