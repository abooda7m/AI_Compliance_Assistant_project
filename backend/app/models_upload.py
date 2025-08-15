from pydantic import BaseModel
from typing import List, Optional

class UploadResponse(BaseModel):
    file_id: str
    filename: str
    pages: Optional[int] = None

class SensitivityFinding(BaseModel):
    type: str          # e.g., email, phone, iban, national_id
    value: str
    page: Optional[int] = None
    start: Optional[int] = None
    end: Optional[int] = None
    severity: str      # low | medium | high

class SensitivityReport(BaseModel):
    is_sensitive: bool
    summary: str
    findings: List[SensitivityFinding]

class Violation(BaseModel):
    document: str
    page: Optional[str] = "Not specified"
    section: Optional[str] = None
    regulation_citation: str  # file | page | group
    value: str                # the specific policy text that violates the regulation
    explanation: str

class ComplianceReport(BaseModel):
    compliance_score: float          # 0..100
    coverage_summary: str
    violations: List[Violation]
    used_context: List[str]          # the citations list you already build