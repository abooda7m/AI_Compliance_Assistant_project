# main.py - Placeholder
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.qa import router as qa_router
from app.routers.upload import router as upload_router
from app.routers.sensitivity import router as sens_router
from app.routers.audit import router as audit_router
from app.routers.policies import router as policies_router
from app.routers.db_audit import router as db_audit_router

# Initialize FastAPI app

app = FastAPI()
app.add_middleware(CORSMiddleware, 
    allow_origins=["*"],  # Adjust as needed for your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(qa_router, prefix="", tags=["qa"])
app.include_router(upload_router, prefix = "" , tags=["upload"])
app.include_router(sens_router, prefix = "" , tags=["sensitivity"])
app.include_router(audit_router, prefix = "" , tags=["audit"])
app.include_router(policies_router, prefix = "" , tags=["regs-policies"])
app.include_router(db_audit_router, prefix="", tags=["db-compliance"])



