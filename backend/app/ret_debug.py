# backend/app/retrieval_debug.py

import os
from dotenv import load_dotenv
from langchain_community.embeddings import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

# Load your key
load_dotenv()

# Point at the exact folder where you persisted Chroma
CHROMA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/chroma_db/regs"))

# Initialize
emb = OpenAIEmbeddings(model="text-embedding-3-large")
db  = Chroma(persist_directory=CHROMA_PATH, embedding_function=emb)
retriever = db.as_retriever(search_kwargs={"k": 5})

# Test query
query = "What are the requirements for obtaining user consent under the data protection law?"
docs = retriever.get_relevant_documents(query)

print(f"Query → {query!r}")

print(f"Retrieved {len(docs)} documents:\n")
for i, d in enumerate(docs, 1):
    meta = d.metadata
    snippet = d.page_content.replace("\n", " ")[:200]
    print(f"{i}. {meta.get('source_file')} | page {meta.get('page')} | group {meta.get('group')}")
    print("   →", snippet, "\n")