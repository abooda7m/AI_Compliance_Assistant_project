# app/routers/policies.py
from __future__ import annotations

from typing import List
from fastapi import APIRouter, HTTPException

from app.schemas.policies import (
    PolicyPlanRequest,
    PolicyPlanResponse,
    PolicyPlanComposeRequest,
    PolicyPlanComposeResponse,
    PolicyPlan,
    PolicyDoc,
    POLICY_INDEX,
)
from app.policies_planner import plan_policies_rule_based
from app.regs_retrieval import fetch_clauses
from app.policies_composer import compose_policy_text
from app.persist import persist_policy_plan, persist_policy_doc

router = APIRouter(tags=["regs-policies"])
DEFAULT_CHAT_MODEL = "gpt-4"

# Per-policy topic terms to help the fact-aware reranker prioritize relevant chunks
TOPIC_TERMS_BY_POLICY = {
    "privacy_policy": [
        "privacy notice", "notice", "transparency", "recipients", "third party", "disclosure", "rights", "controller"
    ],
    "security_toms": [
        "technical and organizational", "tom", "encryption", "access control", "mfa", "rbac", "logging"
    ],
    "retention_policy": [
        "retention", "deletion", "destruction", "anonymization", "erasure", "storage limitation"
    ],
    "incident_response": [
        "breach", "incident", "notification", "notify", "response", "containment", "report"
    ],
    "cross_border_policy": [
        "transfer", "cross-border", "outside the kingdom", "scc", "standard contractual clauses", "approval", "assessment"
    ],
    "data_sharing_policy": [
        "data sharing", "third party", "recipient", "disclosure", "controller", "processor", "agreement", "accountability"
    ],
    "data_classification_policy": [
        "classification", "public", "restricted", "confidential", "sensitive", "label", "marking"
    ],
}

@router.post("/regs/policies/plan", response_model=PolicyPlanResponse)
def policies_plan(payload: PolicyPlanRequest) -> PolicyPlanResponse:
    if not payload.facts.company_name.strip():
        raise HTTPException(status_code=400, detail="company_name is required in facts.")

    plan: PolicyPlan = plan_policies_rule_based(
        facts=payload.facts,
        language=payload.language,
        max_policies=payload.max_policies,
        include_only=payload.include_only,
        exclude=payload.exclude,
    )

    # Persist plan (best-effort; response remains the same)
    try:
        persist_policy_plan(company_name=payload.facts.company_name, facts=payload.facts, plan=plan)
    except Exception as e:
        print("persist_policy_plan (plan only) failed:", e)

    return PolicyPlanResponse(company_name=payload.facts.company_name, plan=plan)

@router.post("/regs/policies/plan-compose", response_model=PolicyPlanComposeResponse)
def plan_and_compose(payload: PolicyPlanComposeRequest) -> PolicyPlanComposeResponse:
    if not payload.facts.company_name.strip():
        raise HTTPException(status_code=400, detail="company_name is required in facts.")

    plan: PolicyPlan = plan_policies_rule_based(
        facts=payload.facts,
        language=payload.language,
        max_policies=payload.max_policies,
        include_only=payload.include_only,
        exclude=payload.exclude,
    )

    # Save the plan first; use plan_id for child docs
    plan_id = None
    try:
        plan_id = persist_policy_plan(company_name=payload.facts.company_name, facts=payload.facts, plan=plan)
    except Exception as e:
        print("persist_policy_plan (compose) failed:", e)

    out_docs: List[PolicyDoc] = []
    for item in plan.items:
        topic_terms = TOPIC_TERMS_BY_POLICY.get(item.policy_id, [])

        pulled = fetch_clauses(
            query=item.search_query,
            k=item.k,
            preferred_sources=item.preferred_sources,
            facts=payload.facts,
            topic_terms=topic_terms,
            rerank_top=item.k,
            min_score=1.0,
        )
        excerpts = pulled.get("docs", []) or []
        citations = pulled.get("citations", []) or []

        if not excerpts:
            alt_query = (item.title or "").split("(")[0].strip() or item.policy_id.replace("_", " ")
            pulled = fetch_clauses(
                query=alt_query,
                k=max(item.k, 12),
                preferred_sources=None,
                group=None,
                facts=payload.facts,
                topic_terms=topic_terms,
                rerank_top=item.k,
                min_score=None,
            )
            excerpts = pulled.get("docs", []) or []
            citations = pulled.get("citations", []) or []

        if not excerpts:
            continue

        title = item.title or POLICY_INDEX[item.policy_id]["title"]
        filename = title.lower().replace(" ", "_") + (".md" if payload.format == "markdown" else ".txt")

        content = compose_policy_text(
            model_name=DEFAULT_CHAT_MODEL,
            policy_title=title,
            facts=payload.facts,
            excerpts=excerpts,
            citations=citations,
            language=payload.language,
            fmt=payload.format,
        )
        if not content.strip():
            continue

        # Persist the composed doc (best-effort)
        try:
            persist_policy_doc(
                plan_id=plan_id,
                policy_id=item.policy_id,
                title=title,
                filename=filename,
                content=content,
                citations=citations,
                used_clause_texts=[e for e in excerpts if e and e.strip()],
            )
        except Exception as e:
            print("persist_policy_doc failed:", e)

        out_docs.append(PolicyDoc(
            policy_id=item.policy_id,
            title=title,
            filename=filename,
            content=content,
            citations=citations,
            used_clause_texts=[e for e in excerpts if e and e.strip()],
        ))

    if not out_docs:
        raise HTTPException(
            status_code=424,
            detail="No SDAIA excerpts found; cannot generate grounded policies. Check Chroma path/collection/metadata."
        )

    return PolicyPlanComposeResponse(
        company_name=payload.facts.company_name,
        plan=plan,
        policies=out_docs,
    )
