# app/schemas/company.py
from __future__ import annotations
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class CompanyFacts(BaseModel):
    company_name: str = Field(..., description="Organization name")
    activities: List[str] = Field(..., description="What the company does")
    purposes: List[str] = Field(default_factory=list)
    data_categories: List[str] = Field(default_factory=list)
    data_subjects: List[str] = Field(default_factory=list)
    processors: List[str] = Field(default_factory=list)
    recipients: List[str] = Field(default_factory=list)
    cross_border: Optional[str] = None
    retention_overview: Optional[str] = None
    security_measures: List[str] = Field(default_factory=list)
    breach_sla_hours: int = Field(72, ge=1, le=168)
    minors_involved: bool = False
    special_categories: bool = False
    contacts: Dict[str, str] = Field(default_factory=dict)