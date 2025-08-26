from typing import Optional, Any, Dict, List
from app.supa import supa

def find_document_id(file_id_or_uuid: str, org_id: str) -> Optional[str]:
    """Returns the document id for this org, if it exists."""
    c = supa()
    r = (
        c.table("documents")
        .select("id")
        .eq("org_id", org_id)
        .eq("id", file_id_or_uuid)
        .limit(1)
        .execute()
    )
    if r.data:
        return r.data[0]["id"]
    return None

def persist_sensitivity(
    org_id: str,
    document_id: str,
    is_sensitive: bool,
    score: Optional[float],
    summary: Optional[str],
    findings: List[Dict[str, Any]],
):
    c = supa()
    c.table("sensitivity_reports").insert({
        "org_id": org_id,
        "document_id": document_id,
        "is_sensitive": is_sensitive,
        "score": score,
        "summary": summary,
        "findings": findings,
    }).execute()

def persist_audit(
    org_id: str,
    document_id: str,
    compliance_score: Optional[float],
    coverage_summary: Optional[str],
    violations: Any,
    used_context: Any,
):
    c = supa()
    c.table("audit_reports").insert({
        "org_id": org_id,
        "document_id": document_id,
        "compliance_score": compliance_score,
        "coverage_summary": coverage_summary,
        "violations": violations,
        "used_context": used_context,
    }).execute()

# (policy functions unchanged)
def persist_policy_plan(plan: Dict[str, Any]) -> str:
    c = supa()
    ins = c.table("policy_plans").insert(plan).select("id").single().execute()
    return ins.data["id"]

def persist_policy_doc(doc: Dict[str, Any]) -> str:
    c = supa()
    ins = c.table("policies").insert(doc).select("id").single().execute()
    return ins.data["id"]
