import re
from typing import List, Tuple, Dict

# Basic patterns (tune for KSA where helpful)
REGEXES = {
    "email": r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
    "phone": r"(?:\+?966|0)5\d{8}",        # KSA mobiles like +9665XXXXXXXX or 05XXXXXXXX
    "iban":  r"\bSA\d{2}[A-Z0-9]{22}\b",   # Saudi IBAN: SA + 2 digits + 22 alnum
    "credit_card": r"\b(?:\d[ -]*?){13,19}\b",
    # simple pass: 10-digit national id/iqama (adjust if you want stricter checks)
    "national_id": r"\b\d{10}\b",
}

def find_matches(text: str) -> List[Dict]:
    findings = []
    for t, pattern in REGEXES.items():
        for m in re.finditer(pattern, text):
            findings.append({
                "type": t,
                "value": m.group(0),
                "start": m.start(),
                "end": m.end(),
                "severity": "high" if t in {"iban","credit_card","national_id"} else "medium"
            })
    return findings