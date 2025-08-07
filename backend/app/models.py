from pydantic import BaseModel
from typing import List

class QARequest(BaseModel):
    question: str
    
class QAResponse(BaseModel):
    answer: str
    citations: List[str]
    
