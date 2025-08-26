# backend/app/routers/sensitivity.py
import os
import re
from fastapi import APIRouter, HTTPException, Query, Depends
from app.utils_files import load_and_chunk, UPLOAD_DIR, chunk_with_loader
from app.storage import DISABLE_PERSISTENT_CACHE, ephemeral_document_path, download_to_path
from app.deps_auth import get_auth
from app.supa import supa
from app.persist import find_document_id, persist_sensitivity

# domain logic (existing in your repo)
from app.sensitivity_rules import find_matches
from app.sensitivity_llm import judge_snippet

router = APIRouter(tags=["sensitivity"])


# ---------- simple regex fallback (always available) ----------
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
# KSA mobile like 05XXXXXXXX (10 digits) + generic +9665xxxxxxxx
_PHONE_RE = re.compile(r"\b(?:\+?9665\d{8}|05\d{8})\b")
# KSA National ID (10 digits, starts with 1 or 2)
_NATIONAL_ID_RE = re.compile(r"\b[12]\d{9}\b")
# Saudi IBAN (SA + 22 digits = 24 chars total)
_IBAN_SA_RE = re.compile(r"\bSA\d{22}\b", re.IGNORECASE)

def regex_fallback_findings(text: str, page: int | None) -> list[dict]:
    findings: list[dict] = []

    def add(kind: str, m: re.Match, severity: str):
        findings.append({
            "type": kind,
            "value": m.group(0),
            "start": m.start(),
            "end": m.end(),
            "page": page,
            "severity": severity,
        })

    for m in _EMAIL_RE.finditer(text):
        add("email", m, "medium")

    for m in _PHONE_RE.finditer(text):
        add("phone", m, "medium")

    for m in _NATIONAL_ID_RE.finditer(text):
        add("national_id", m, "high")

    for m in _IBAN_SA_RE.finditer(text):
        add("iban_sa", m, "high")

    return findings
# --------------------------------------------------------------


@router.get("/sensitivity")
def check_sensitivity(file_id: str = Query(...), auth = Depends(get_auth)):
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
            return _analyze_and_persist(file_id, path, org_id)

    # persistent cache path
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

    return _analyze_and_persist(file_id, path, org_id)


def _analyze_and_persist(file_id: str, path: str, org_id: str):
    # Load pages/chunks
    chunks = chunk_with_loader(path, 800, 100) if DISABLE_PERSISTENT_CACHE else load_and_chunk(path, 800, 100)

    findings: list[dict] = []
    labels: list[str] = []

    for ch in chunks[:50]:
        text = ch.page_content or ""
        page = ch.metadata.get("page")

        # 1) your existing rule-based matches
        base_matches = []
        try:
            base_matches = list(find_matches(text)) or []
        except Exception:
            base_matches = []

        for f in base_matches:
            findings.append({
                "type": f.get("type") or f.get("label") or "match",
                "value": f.get("value") or f.get("text") or "",
                "start": f.get("start"),
                "end": f.get("end"),
                "page": page,
                "severity": f.get("severity") or "medium",
            })

        # 2) LLM snippet judgement (optional label)
        try:
            verdict = judge_snippet(text) or {}
            lbl = verdict.get("label") or verdict.get("verdict")
            if lbl:
                labels.append(lbl)
        except Exception:
            pass

        # 3) Fallback regex matches to guarantee common signals
        #    (email, phone, KSA national ID, SA IBAN)
        findings.extend(regex_fallback_findings(text, page))

    is_sensitive = (any(lbl == "Sensitive" for lbl in labels)) or (len(findings) > 0)
    if is_sensitive:
        summary = f"Detected {len(findings)} sensitive indicator(s) across document."
    else:
        summary = "No sensitive indicators detected."

    # Persist (org-aware)
    try:
        doc_id = find_document_id(file_id, org_id) or file_id
        persist_sensitivity(org_id, doc_id, is_sensitive, None, summary, findings)
    except Exception:
        pass

    return {"is_sensitive": is_sensitive, "summary": summary, "findings": findings}
