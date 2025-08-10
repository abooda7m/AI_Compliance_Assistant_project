from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate

PROMPT = ChatPromptTemplate.from_template(
"""You are a data classification assistant.

Classify the following text as Sensitive or Not Sensitive under data protection context in KSA (SDAIA style). 
Consider personal identifiers, financial info, health info, credentials, or any data that reasonably links to a person.

Return a short, neutral summary and a one-word label: Sensitive or Not Sensitive.

Text:
{snippet}
---
Respond in JSON: {{"label":"Sensitive|Not Sensitive","summary":"..."}}
"""
)

llm = ChatOpenAI(model_name="gpt-4")  # key from env

def judge_snippet(snippet: str) -> dict:
    msg = PROMPT.format(snippet=snippet[:2000])
    out = llm.predict(msg)
    # very light parse (expecting a small JSON)
    import json
    try:
        return json.loads(out)
    except Exception:
        return {"label": "Not Sensitive", "summary": "Could not parse model output"}