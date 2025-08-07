# main.py - Placeholder
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.qa import router as qa_router

app = FastAPI()
app.add_middleware(CORSMiddleware, 
    allow_origins=["*"],  # Adjust as needed for your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)
app.include_router(qa_router, prefix="", tags=["qa"])

