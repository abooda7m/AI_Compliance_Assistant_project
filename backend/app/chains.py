# # backend/app/chains.py

# import os
# from dotenv import load_dotenv

# load_dotenv()  # Load environment variables from .env file

# # 3) LangChain imports (community editions to avoid deprecation)
# from langchain_community.embeddings import OpenAIEmbeddings
# from langchain_community.vectorstores import Chroma
# from langchain_openai import ChatOpenAI
# from langchain.prompts import PromptTemplate
# from langchain.chains import LLMChain

# def make_manual_qa_chain():
#     # a) Build your vector store with the key
#     emb = OpenAIEmbeddings(
#         model="text-embedding-3-large"
#     )
#     store_path = os.path.abspath(
#         os.path.join(os.path.dirname(__file__), "../../chroma_db/regs")
#     )
#     vs = Chroma(persist_directory=store_path, embedding_function=emb)
#     retriever = vs.as_retriever(search_kwargs={"k": 4})

#     # b) Build your chain with a matching PromptTemplate
#     PROMPT = PromptTemplate(
#         input_variables=["context", "question"],
#         template=(
#             "You are a regulatory compliance assistant …\n\n"
#             "Context:\n{context}\n\n"
#             "User Question:\n{question}\n\n"
#             "Your Answer:"
#         )
#     )
#     llm_chain = LLMChain(
#         llm=ChatOpenAI(
#             model_name="gpt-4"
#         ),
#         prompt=PROMPT
#     )

#     # c) Return the function that does retrieval + LLM call
#     def run_qa(question: str):
#         docs = retriever.get_relevant_documents(question)
#         context = "\n\n".join(d.page_content for d in docs)
#         # invoke returns a string
#         answer:str = llm_chain.run(context= context, question = question)
#         return answer, docs

#     return run_qa




# backend/app/chains.py

import os
from dotenv import load_dotenv
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.prompts import ChatPromptTemplate

# 1️⃣ Load environment variables (adjust path if .env lives elsewhere)
load_dotenv()

# 2️⃣ Paths & prompt template
CHROMA_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "../chroma_db/chroma_db/regs"))

PROMPT_TEMPLATE = """Answer the question based only on the following context:

{context}

---

Answer the question based on the above context: {question}
"""

def make_manual_qa():
    """
    Returns a function run_qa(question: str) -> (answer: str | None, sources: List[str])
    which:
      1. Retrieves top-k documents with relevance scores.
      2. If top score < threshold, returns (None, []).
      3. Otherwise, builds a context from the docs, prompts GPT-4, and returns its answer + citations.
    """
    # Initialize embedding function and vector store
    embedding_fn = OpenAIEmbeddings( model="text-embedding-3-large")
    db           = Chroma(persist_directory=CHROMA_PATH, embedding_function=OpenAIEmbeddings( model="text-embedding-3-large"))

    # Prepare prompt template and LLM
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    model           = ChatOpenAI( model_name="gpt-4")

    def run_qa(question: str, k: int = 5, threshold: float = 0.5):
        # 1) Retrieve top-k docs + their relevance scores
        results = db.similarity_search_with_relevance_scores(question, k=k)

        # 2) Bail out if no doc is above the threshold
        # if not results or results[0][1] < threshold:
        #     return None, []

        # 3) Build the context string from the retrieved chunks
        context = "\n\n---\n\n".join(doc.page_content for doc, _ in results)

        # 4) Format the chat prompt
        prompt = prompt_template.format(context=context, question=question)

        # 5) Call GPT-4
        answer = model.predict(prompt)

        # 6) Extract and format citation metadata
        sources = [
            f"{doc.metadata.get('source_file','?')} | page {doc.metadata.get('page','?')} | group {doc.metadata.get('group','?')}"
            for doc, _ in results
        ]

        return answer, sources

    return run_qa