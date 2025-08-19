# app/services/policies_planner.py
from __future__ import annotations
from typing import List, Set
from app.config.sdaia_sources import SDAIA_SOURCE_FILES
from app.schemas.company import CompanyFacts
from app.schemas.policies import (
    ALLOWED_POLICIES, POLICY_INDEX, DEFAULT_QUERIES,
    PolicyPlan, PolicyPlanItem
)

MAX_SOURCES_PER_POLICY = 20

# Tiered sources per policy (strict subset of your filenames)
SOURCES_BY_POLICY = {
    "privacy_policy": {
        "primary": ["PrivacyPolicyGuideline.pdf", "ImplementingRegulationPersonalDataProtectionLaw.pdf"],
        "secondary": ["Personal Data English V2-23April2023- Reviewed-.pdf", "PoliciesEn001.pdf"],
        "optional": ["Saudi Data & AI Authority.pdf"],
    },
    "retention_policy": {
        "primary": ["PersonalDataDestructionAnonymizationAndEncryptionGuideline.pdf", "DataClassificationPolicy.pdf"],
        "secondary": ["ImplementingRegulationPersonalDataProtectionLaw.pdf", "Personal Data English V2-23April2023- Reviewed-.pdf"],
        "optional": [],
    },
    "security_toms": {
        "primary": ["DataClassificationPolicy.pdf", "MinmumPDGuideline.pdf"],
        "secondary": ["PersonalDataDestructionAnonymizationAndEncryptionGuideline.pdf", "AI Ethics Principles.pdf"],
        "optional": ["Saudi Data & AI Authority.pdf"],
    },
    "incident_response": {
        "primary": ["PersonalDataBreachIncidents.pdf"],
        "secondary": ["ImplementingRegulationPersonalDataProtectionLaw.pdf", "PoliciesEn001.pdf"],
        "optional": [],
    },
    "dsr_procedure": {
        "primary": ["PersonalDataProcessingActivitiesRecordsGuideline.pdf", "PersonalDataDisclosureCasesGuideline.pdf"],
        "secondary": ["ImplementingRegulationPersonalDataProtectionLaw.pdf", "Personal Data English V2-23April2023- Reviewed-.pdf"],
        "optional": ["PoliciesEn001.pdf"],
    },
    "cross_border_policy": {
        "primary": ["Regulation+on+Personal+Data+Transfer+Outside+the+Kingdom..pdf", "StandardContractualClausesForPersonalDataTransferEN.pdf"],
        "secondary": ["Risk+Assessment+Guideline+for+Transferring+Personal+Data+Outside+the+Kingdom.pdf", "CommonRulesBCRForPersonalDataTransferEN.pdf", "ImplementingRegulationPersonalDataProtectionLaw.pdf"],
        "optional": ["Personal Data English V2-23April2023- Reviewed-.pdf"],
    },
    "cookie_policy": {
        "primary": ["PrivacyPolicyGuideline.pdf"],
        "secondary": ["ImplementingRegulationPersonalDataProtectionLaw.pdf", "PoliciesEn001.pdf"],
        "optional": [],
    },
    "data_sharing_policy": {
        "primary": ["Data+Sharing+Policy.pdf"], "secondary": ["PersonalDataDisclosureCasesGuideline.pdf"], "optional": []
    },
    "data_classification": {
        "primary": ["DataClassificationPolicy.pdf"], "secondary": ["MinmumPDGuideline.pdf"], "optional": []
    },
    "secondary_use_policy": {
        "primary": ["Draft General Rules for Secondary Use of Data.pdf"], "secondary": ["Data+Sharing+Policy.pdf"], "optional": []
    },
    "dpo_appointment": {
        "primary": ["RulesforAppointingPersonalDataProtectionOfficer.pdf"], "secondary": ["Saudi Data & AI Authority.pdf"], "optional": []
    },
    "ai_governance_policy": {
        "primary": ["AI Ethics Principles.pdf", "GenAIGuidelinesForGovernmentENCompressed.pdf"],
        "secondary": ["Generative Al Guideline for Public.pdf"],
        "optional": ["Saudi Data & AI Authority.pdf"],
    },
    "controller_register": {
        "primary": ["TheRulesGoverningTheNationalRegisterOfControllersWithinTheKingdomPublicEN.pdf"],
        "secondary": [],
        "optional": [],
    },
    "bcr_policy": {
        "primary": ["CommonRulesBCRForPersonalDataTransferEN.pdf"], "secondary": [], "optional": []
    },
    "committee_rules": {
        "primary": ["CommitteeWorkingRules.pdf"], "secondary": [], "optional": []
    },
}

def _pick_sources(policy_id: str, limit: int = MAX_SOURCES_PER_POLICY) -> List[str]:
    available = set(SDAIA_SOURCE_FILES)
    cfg = SOURCES_BY_POLICY.get(policy_id, {"primary": [], "secondary": [], "optional": []})
    ordered = cfg["primary"] + cfg["secondary"] + cfg["optional"]
    picks: List[str] = [f for f in ordered if f in available]
    if len(picks) < limit:
        for f in SDAIA_SOURCE_FILES:
            if f not in picks:
                picks.append(f)
            if len(picks) >= limit:
                break
    return picks[:limit]

def _suggest_policies(facts: CompanyFacts) -> List[str]:
    """Simple, readable heuristics to pick policies; capped later by max_policies."""
    chosen: List[str] = []
    add = chosen.append

    # Always baseline
    add("privacy_policy")
    add("security_toms")

    # Retention if any retention text or processors/recipients exist
    if facts.retention_overview or facts.processors or facts.recipients:
        add("retention_policy")

    # Incident response if SLA set or security measures present
    if facts.breach_sla_hours or facts.security_measures:
        add("incident_response")

    # Cross-border if mentioned
    if facts.cross_border:
        add("cross_border_policy")

    # Data sharing if recipients or processors beyond hosting
    if any(x for x in facts.recipients if x) or any(x for x in facts.processors if x and "host" not in x.lower()):
        add("data_sharing_policy")

    # Classification if security measures present or multiple categories
    if facts.security_measures or len(facts.data_categories) >= 2:
        add("data_classification")

    # DSR procedures if customers/employees or many categories
    if facts.data_subjects or len(facts.data_categories) >= 2:
        add("dsr_procedure")

    # AI governance if activities/purposes mention AI/ML/GenAI
    txt = " ".join(facts.activities + facts.purposes).lower()
    if any(k in txt for k in ["ai", "ml", "model", "genai", "gpt"]):
        add("ai_governance_policy")

    # BCR if cross-border and multi-entity
    if facts.cross_border and len(facts.processors) + len(facts.recipients) >= 2:
        add("bcr_policy")

    # Committee rules for larger org signals (many subjects/processors)
    if len(facts.data_subjects) >= 2 and len(facts.processors) >= 2:
        add("committee_rules")

    # Secondary use if analytics/marketing present
    if any(p.lower() in ["analytics", "research", "marketing"] for p in facts.purposes):
        add("secondary_use_policy")

    # Controller register for external-facing services
    if any("platform" in a.lower() or "service" in a.lower() for a in facts.activities):
        add("controller_register")

    # Cookies if web/mobile activities
    if any(x in txt for x in ["web", "site", "cookie", "mobile", "app"]):
        add("cookie_policy")

    # Deduplicate preserving order
    seen: Set[str] = set()
    deduped = [p for p in chosen if not (p in seen or seen.add(p))]
    return [p for p in deduped if p in ALLOWED_POLICIES]

def plan_policies_rule_based(
    *,
    facts: CompanyFacts,
    language: str,
    max_policies: int,
    include_only: List[str] | None,
    exclude: List[str] | None,
) -> PolicyPlan:
    include_only = include_only or []
    exclude = exclude or []
    picks = _suggest_policies(facts)

    # apply include/exclude
    if include_only:
        picks = [p for p in picks if p in include_only]
    if exclude:
        picks = [p for p in picks if p not in exclude]

    if not picks:
        picks = ["privacy_policy", "security_toms"]

    items: List[PolicyPlanItem] = []
    for pid in picks[:max_policies]:
        items.append(PolicyPlanItem(
            policy_id=pid,
            title=POLICY_INDEX[pid]["title"],
            reason="Selected by rule-based planner based on provided facts.",
            search_query=DEFAULT_QUERIES[pid],
            k=6,
            preferred_sources=_pick_sources(pid, 6),
        ))
    return PolicyPlan(items=items)