# backend/app/routers/audit.py
import os
from fastapi import APIRouter, HTTPException, Query, Depends
from app.utils_files import UPLOAD_DIR
from app.storage import DISABLE_PERSISTENT_CACHE, ephemeral_document_path, download_to_path
from app.deps_auth import get_auth
from app.supa import supa
from app.persist import find_document_id, persist_audit
# domain logic
from app.audit_policy import audit_uploaded_file

router = APIRouter(tags=["audit"])

@router.get("/audit")
def audit(file_id: str = Query(...), auth = Depends(get_auth)):
    user_id, org_id, _ = auth
    c = supa()

    if DISABLE_PERSISTENT_CACHE:
        r = (
            c.table("documents")
            .select("id, filename, storage_url, uploaded_by")
            .eq("org_id", org_id)
            .eq("id", file_id)
            .single()
            .execute()
        )
        row = r.data
        if not row or not row.get("storage_url"):
            raise HTTPException(status_code=404, detail="File not found. Upload first.")
        if row["uploaded_by"] != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        with ephemeral_document_path(c, row["storage_url"], filename_hint=row.get("filename")) as path:
            return _audit_and_persist(file_id, path, org_id)

    # persistent cache branch
    path = os.path.join(UPLOAD_DIR, file_id)
    if not os.path.exists(path):
        r = (
            c.table("documents")
            .select("id, filename, local_path, storage_url, uploaded_by")
            .eq("org_id", org_id)
            .eq("id", file_id)
            .single()
            .execute()
        )
        row = r.data
        if not row:
            raise HTTPException(status_code=404, detail="File not found. Upload first.")
        if row["uploaded_by"] != user_id:
            raise HTTPException(status_code=403, detail="Forbidden")

        if row.get("local_path") and os.path.exists(row["local_path"]):
            path = row["local_path"]
        elif row.get("storage_url"):
            bucket, storage_path = row["storage_url"].split("/", 1)
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            cache_path = os.path.join(UPLOAD_DIR, f"{row['id']}_{row['filename']}")
            path = download_to_path(c, bucket, storage_path, cache_path)
            try:
                c.table("documents").update({"local_path": path}).eq("id", row["id"]).execute()
            except Exception:
                pass
        else:
            raise HTTPException(status_code=404, detail="File not found. Upload first.")

    return _audit_and_persist(file_id, path, org_id)


def _audit_and_persist(file_id: str, path: str, org_id: str):
    result = audit_uploaded_file(path)
    breakdown = result.get("breakdown", {"assessed": 0, "compliant": 0, "non_compliant": 0, "unclear": 0})
    summary = (
        f"Assessed {breakdown.get('assessed', 0)} chunks "
        f"(compliant {breakdown.get('compliant', 0)}, "
        f"non-compliant {breakdown.get('non_compliant', 0)}, "
        f"unclear {breakdown.get('unclear', 0)}). "
        f"Overall compliance: {result.get('score', 0)}%."
    )

    try:
        doc_id = find_document_id(file_id, org_id) or file_id
        persist_audit(
            org_id=org_id,
            document_id=doc_id,
            compliance_score=result.get("score"),
            coverage_summary=summary,
            violations=result.get("violations"),
            used_context=result.get("citations"),
        )
    except Exception:
        pass

    return {
        "compliance_score": result.get("score"),
        "coverage_summary": summary,
        "violations": result.get("violations"),
        "used_context": result.get("citations"),
    }
