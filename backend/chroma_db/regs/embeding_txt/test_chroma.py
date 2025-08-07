# test_chroma.py

from dotenv import load_dotenv
load_dotenv()  # Load OPENAI_API_KEY from .env file

from langchain_openai import OpenAIEmbeddings
from langchain_chroma import Chroma

# Load the persisted Chroma vector store
vector_store = Chroma(
    persist_directory="../../chroma_db/regs",  # Path to your existing DB
    embedding_function=OpenAIEmbeddings(model="text-embedding-3-large")
)

# Run a similarity search
query = "What are the requirements for obtaining user consent under the data protection law?"
documents = vector_store.similarity_search(query, k=3)

# Print results with safe metadata access
print("\nTop relevant chunks:\n")

for doc in documents:
    source = doc.metadata.get("source_file", "Unknown Source")
    page   = doc.metadata.get("page",        "Unknown Page")
    group  = doc.metadata.get("group",       "Unknown Group")

    print(f"─ Chunk from {source}, page {page}, group {group} ─")
    print(doc.page_content)
    print()
    