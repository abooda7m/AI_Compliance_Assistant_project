# app/schemas/policies.py
from __future__ import annotations
from typing import Dict, List, Optional
from pydantic import BaseModel, Field
from .company import CompanyFacts

# Policy catalogue aligned to your SDAIA files (IDs → titles)
POLICY_INDEX: Dict[str, Dict[str, str]] = {
    "privacy_policy":        {"title": "Privacy Policy (SDAIA-aligned)"},
    "retention_policy":      {"title": "Data Retention & Deletion Policy"},
    "security_toms":         {"title": "Security Measures (Technical & Organizational)"},
    "incident_response":     {"title": "Incident & Breach Response Policy"},
    "dsr_procedure":         {"title": "Data Subject Rights Handling Procedure"},
    "cross_border_policy":   {"title": "Cross-Border Data Transfer Policy"},
    "cookie_policy":         {"title": "Cookie & Tracking Technologies Policy"},
    "data_sharing_policy":   {"title": "Data Sharing Policy"},
    "data_classification":   {"title": "Data Classification Policy"},
    "secondary_use_policy":  {"title": "Secondary Use of Data Policy"},
    "dpo_appointment":       {"title": "DPO Appointment & Governance Policy"},
    "ai_governance_policy":  {"title": "AI & Generative AI Governance Policy"},
    "controller_register":   {"title": "Controller National Register Procedure"},
    "bcr_policy":            {"title": "Binding Corporate Rules (BCR) Policy"},
    "committee_rules":       {"title": "Data Governance Committee Working Rules"},
}
ALLOWED_POLICIES = list(POLICY_INDEX.keys())

# File-seeded fallback queries (also used by planner)
DEFAULT_QUERIES = {
    "privacy_policy": "PrivacyPolicyGuideline.pdf ImplementingRegulationPersonalDataProtectionLaw.pdf transparency notice purposes categories recipients retention rights cookies",
    "retention_policy": "PersonalDataDestructionAnonymizationAndEncryptionGuideline.pdf DataClassificationPolicy.pdf retention deletion erasure backups logs",
    "security_toms": "DataClassificationPolicy.pdf MinmumPDGuideline.pdf technical organizational measures encryption RBAC MFA logging",
    "incident_response": "PersonalDataBreachIncidents.pdf breach notification timelines authority data subjects",
    "dsr_procedure": "PersonalDataProcessingActivitiesRecordsGuideline.pdf PersonalDataDisclosureCasesGuideline.pdf data subject rights access rectification erasure portability restriction timelines verification",
    "cross_border_policy": "Regulation+on+Personal+Data+Transfer+Outside+the+Kingdom..pdf StandardContractualClausesForPersonalDataTransferEN.pdf Risk+Assessment+Guideline+for+Transferring+Personal+Data+Outside+the+Kingdom.pdf CommonRulesBCRForPersonalDataTransferEN.pdf safeguards adequacy contractual clauses",
    "cookie_policy": "PrivacyPolicyGuideline.pdf cookies tracking consent categories retention",
    "data_sharing_policy": "Data+Sharing+Policy.pdf data sharing agreements roles purpose limitation governance",
    "data_classification": "DataClassificationPolicy.pdf classification levels handling rules labeling access control",
    "secondary_use_policy": "Draft General Rules for Secondary Use of Data.pdf compatibility assessment lawful basis consent exceptions",
    "dpo_appointment": "RulesforAppointingPersonalDataProtectionOfficer.pdf qualifications responsibilities independence",
    "ai_governance_policy": "AI Ethics Principles.pdf GenAIGuidelinesForGovernmentENCompressed.pdf Generative Al Guideline for Public.pdf fairness accountability transparency risk",
    "controller_register": "TheRulesGoverningTheNationalRegisterOfControllersWithinTheKingdomPublicEN.pdf registration obligations process updates",
    "bcr_policy": "CommonRulesBCRForPersonalDataTransferEN.pdf intra-group transfers requirements approval oversight",
    "committee_rules": "CommitteeWorkingRules.pdf committee responsibilities quorum procedures documentation",
}

# ---- Planner I/O ----
class PolicyPlanItem(BaseModel):
    policy_id: str = Field(..., description=f"One of: {ALLOWED_POLICIES}")
    title: str
    reason: str
    search_query: str
    k: int = Field(6, ge=1, le=20)
    preferred_sources: List[str] = Field(default_factory=list)

class PolicyPlan(BaseModel):
    items: List[PolicyPlanItem]

class PolicyPlanRequest(BaseModel):
    facts: CompanyFacts
    language: str = Field("en", pattern="^(en|ar)$")
    max_policies: int = Field(7, ge=1, le=12)
    include_only: Optional[List[str]] = None
    exclude: Optional[List[str]] = None

class PolicyPlanResponse(BaseModel):
    company_name: str
    plan: PolicyPlan

# ---- Orchestrator I/O ----
class PolicyDoc(BaseModel):
    policy_id: str
    title: str
    filename: str
    content: str
    citations: List[str] = []
    used_clause_texts: List[str] = []

class PolicyPlanComposeRequest(BaseModel):
    facts: CompanyFacts
    language: str = Field("en", pattern="^(en|ar)$")
    format: str = Field("markdown", pattern="^(markdown|plain)$")
    max_policies: int = Field(7, ge=1, le=12)
    include_only: Optional[List[str]] = None
    exclude: Optional[List[str]] = None
    strict_retrieval: bool = True  # <-- if True, must have excerpts; else fail

class PolicyPlanComposeResponse(BaseModel):
    company_name: str
    plan: PolicyPlan
    policies: List[PolicyDoc]