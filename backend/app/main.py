# main.py
from dotenv import load_dotenv
load_dotenv()

import os
import importlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Compliance Assistant API")

# CORS: allow common dev origins plus FRONTEND_ORIGIN env override
_frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
_defaults = {"http://localhost:5173", "http://127.0.0.1:5173"}
allow_origins = list({*_defaults, _frontend_origin})
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    # Optional deps, guard if not present
    try:
        from app.supa import ORG_ID
    except Exception:
        ORG_ID = None
    try:
        from app.storage import DISABLE_PERSISTENT_CACHE
    except Exception:
        DISABLE_PERSISTENT_CACHE = None
    return {"status": "ok", "org_id": ORG_ID, "diskless": DISABLE_PERSISTENT_CACHE}

def _include_optional(module_path: str, attr: str, *, prefix: str = "", tags: list | None = None):
    """
    Import router safely and include if present.
    Example: _include_optional("app.routers.qa", "router", tags=["qa"])
    """
    try:
        mod = importlib.import_module(module_path)
        router = getattr(mod, attr)
        app.include_router(router, prefix=prefix, tags=tags)
        return True
    except Exception:
        return False

# Routers from both versions, included if available
_include_optional("app.routers.upload", "router", tags=["upload"])
_include_optional("app.routers.sensitivity", "router", tags=["sensitivity"])
_include_optional("app.routers.audit", "router", tags=["audit"])
_include_optional("app.routers.qa", "router", tags=["qa"])
_include_optional("app.routers.reports", "router", tags=["reports"])
_include_optional("app.routers.companies", "router", tags=["companies"])
_include_optional("app.routers.policies", "router", tags=["regs-policies"])
_include_optional("app.routers.db_audit", "router", tags=["db-compliance"])
