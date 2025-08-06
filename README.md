# Smart DataGuard - AI Compliance Assistant

Smart DataGuard is an intelligent compliance audit system designed to help organizations in Saudi Arabia ensure adherence to data protection and cybersecurity regulations, such as the PDPL and NCA ECC.

## Features

- Upload internal documents (policies, contracts, reports, logs , view database)
- OCR-based text extraction from scanned files
- Compare content against official Saudi regulations
- Uses Retrieval-Augmented Generation (RAG) for accurate context-aware analysis
- Detailed compliance report divided by regulation type (PDPL / NCA)
- Web interface with file upload, chat, and report generation

## Tech Stack

| Layer           | Tools / Frameworks                             |
|-----------------|-------------------------------------------------|
| Frontend        | Next.js or React (with Chat and File Upload UI) |
| Backend         | FastAPI (Python)                                |
| OCR             | Google Cloud Vision OCR                         |
| LLM             | LLaMA 3.2 (local, GPU-deployed)                 |
| Embedding Model | mxbai-embed-large                               |
| Vector Store    | ChromaDB                                        |
| RAG Framework   | LangChain (with RouterRAG)                      |
| Infrastructure  | Google Cloud (GCE + GPU)                        |
| File Storage    | Supabase or Google Cloud Storage                |
| Report Output   | HTML or PDF Reports                             |

## Project Structure

```
backend/
├── chroma_db/
│   └── regs/                   # Chroma index for regulations
│       ├── index
│       └── pkl_files…
│
├── requirements.txt
├── .env
│
├── ocr/                       
│   └── extract_text.py         # Contains code using Google Cloud Vision OCR
│
└── app/
    ├── main.py                 # FastAPI entry
    ├── chains.py               # RAG chains
    ├── models.py               # Pydantic models
    └── routers/
        ├── qa.py               # QA chatbot route
        ├── db_check.py         # Route to audit database
        ├── audit.py            # Compare docs with PDPL/NCA
        ├── sensitive.py        # Sensitive data detection
        └── ocr.py              # ← NEW FILE: OCR route handler

frontend/
├── package.json
└── src/
    ├── index.jsx
    ├── App.jsx
    ├── api.js                 # Axios instance
    └── components/
        ├── QAForm.jsx
        ├── DBCheckForm.jsx
        ├── PolicyAudit.jsx
        ├── SensitiveDetect.jsx
        └── OCRUploader.jsx     # ← NEW FILE: Component to upload scanned files (PDF, PNG...)

```

