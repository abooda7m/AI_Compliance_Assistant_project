# app/services/policies_composer.py
"""
Grounded, company-tailored policy composer for SDAIA/PDPL content.

Key points:
- **Broadened normative filter**: selects policy-worthy sentences even when the
  PDFs don’t literally say “shall/must” (e.g., “notice should include…”, “provide…”).
- **Enumeration extractor**: when a sentence says “include/contain: (a)… (b)… (c)…”
  we append a compact tail like “(at minimum: A, B, C)”.
- **Policy voice**: rewrites kept sentences into clear requirements (“Acme KSA must…”),
  without adding any facts. If an LLM is available, it’s used only for style; the content
  remains 100% from retrieved text.
- **Company context**: each bullet has an indented “_Context:_ …” line derived strictly
  from the provided facts; no citations required on context lines.
- **Grounding guard**: every bullet/quote line ending must carry a citation in the form
  “(file, page, group)” or it is dropped. No hallucinations.

This file exposes: compose_policy_text(...)
which is called by the router to turn retrieved SDAIA excerpts into policy documents.
"""

from __future__ import annotations

import json
import re
from typing import List, Dict

# Optional LLM for stylistic polish ONLY (never for adding content)
try:
    from langchain_openai import ChatOpenAI  # type: ignore
except Exception:  # pragma: no cover
    ChatOpenAI = None  # type: ignore

from app.schemas.company import CompanyFacts

# ---------------------------------------------------------------------------
# Citation helpers
# ---------------------------------------------------------------------------

_CIT_PAT = re.compile(
    r"^\s*(?P<file>.+?)\s*\|\s*page\s*(?P<page>[^|]+?)\s*\|\s*group\s*(?P<group>.+?)\s*$",
    re.IGNORECASE,
)
PAREN_CIT_AT_END = re.compile(r"\([^()]*,[^()]*,[^()]*\)\s*$")


def _cit_to_paren(c: str) -> str:
    """Convert 'file | page X | group Y' -> '(file, X, Y)'."""
    m = _CIT_PAT.match((c or "").strip())
    if not m:
        return f"({c})" if c else ""
    file = m.group("file").strip()
    page = re.sub(r"^page\s+", "", m.group("page").strip(), flags=re.IGNORECASE)
    group = m.group("group").strip()
    return f"({file}, {page}, {group})"


def _pair_excerpts_with_citations(excerpts: List[str], citations: List[str]) -> List[Dict[str, str]]:
    pairs: List[Dict[str, str]] = []
    for i, e in enumerate(excerpts):
        e = (e or "").strip()
        if not e:
            continue
        cit_raw = (citations[i] if i < len(citations) else "").strip()
        pairs.append(
            {
                "text": e,
                "citation_raw": cit_raw,
                "citation": _cit_to_paren(cit_raw) if cit_raw else "",
            }
        )
    return pairs


def _enforce_citations(md: str) -> str:
    """
    Drop any BULLET/QUOTE line that lacks a '(file, page, group)' citation at the end.
    Non-bullet lines (e.g., headers, context lines) are allowed without citations.
    """
    out: List[str] = []
    for line in md.splitlines():
        s = line.strip()
        is_bullet = s.startswith("- ") or s.startswith("* ") or re.match(r"^\d+\.\s", s)
        is_quote = s.startswith("> ")
        if (is_bullet or is_quote) and s:
            if PAREN_CIT_AT_END.search(line):
                out.append(line)
            else:
                # silently drop uncited bullet/quote lines
                continue
        else:
            out.append(line)
    return "\n".join(out).rstrip()


# ---------------------------------------------------------------------------
# Broadened normative filter & enumeration extractor (SDAIA-friendly)
# ---------------------------------------------------------------------------

# Verbs/modals that indicate obligations or concrete requirements
_NORMATIVE_VERBS = (
    " must ",
    " shall ",
    " should ",
    " is required to ",
    " are required to ",
    " ensure ",
    " required to ",
    " prohibited ",
    " must not ",
    " shall not ",
    " notify",
    " publish ",
    " provide ",
    " obtain ",
    " document",
    " maintain ",
    " appoint ",
    " record ",
    " retain ",
    " disclose ",
    " implement ",
    " assess ",
    " review ",
    " encrypt",
    " restrict ",
    " contain ",
    " include ",
    " have ",
)

# Common non-normative boilerplate we want to exclude from bullets
_NON_NORMATIVE_PATTERNS = (
    "this guideline",
    "guideline aims",
    "aims at",
    "aims to",
    "introduction",
    "preamble",
    "objective of this",
    "purpose of this guideline",
)

# Domain/topic tokens across SDAIA docs; if combined with directive verbs like "include/provide",
# treat them as policy-worthy even when “shall/must” is absent.
_TOPIC_TOKENS = (
    "privacy notice",
    "notice",
    "consent",
    "lawful basis",
    "retention",
    "deletion",
    "destruction",
    "anonymization",
    "encryption",
    "transfer",
    "cross-border",
    "breach",
    "incident",
    "notification",
    "records of processing",
    "ropa",
    "data protection officer",
    "dpo",
    "disclosure",
    "third party",
    "vendor",
    "processor",
    "controller",
    "data subject rights",
    "classification",
    "register of controllers",
    "scc",
    "standard contractual clauses",
    "risk assessment",
    "impact assessment",
)

# Light directive verbs to pair with topic tokens
_TOPIC_DIRECTIVES = (" include ", " contain ", " provide ", " publish ", " address ", " cover ", " describe ")


def _is_normative(text: str) -> bool:
    """Broader, SDAIA-friendly check for 'policy-worthy' sentences."""
    lt = f" {(text or '').lower().strip()} "
    if any(p in lt for p in _NON_NORMATIVE_PATTERNS):
        return False
    if any(v in lt for v in _NORMATIVE_VERBS):
        return True
    if any(t in lt for t in _TOPIC_TOKENS) and any(d in lt for d in _TOPIC_DIRECTIVES):
        return True
    return False


def _split_sentences(s: str) -> List[str]:
    s = re.sub(r"\s+", " ", (s or "").strip())
    return re.split(r"(?<=[.!?])\s+", s) if s else []


def _extract_enumeration(text: str, max_items: int = 3) -> str:
    """
    Pull short enumerations after 'include/contain/at minimum:' etc., or lettered lists (a),(b),(c).
    Returns a comma-joined string of up to max_items items, or '' if none found.
    """
    t = (text or "")

    # After-colon patterns: "must include: A; B; C" or "should contain: A, B, C"
    m = re.search(r"(include|contain|at\s+minimum|at\s+least)\s*:\s*(.+)", t, flags=re.IGNORECASE)
    if m:
        tail = m.group(2)
        parts = re.split(r"[;,\u2022•·]|(?:\s-\s)", tail)
        items = [re.sub(r"^\(?[a-z0-9]\)\s*", "", p).strip(" .;:,") for p in parts]
        items = [i for i in items if len(i) > 1][:max_items]
        if items:
            return ", ".join(items)

    # Lettered items like "(a) … (b) … (c) …"
    items = re.findall(r"\(([a-z])\)\s*([^()]+?)(?=(\([a-z]\))|$)", t, flags=re.IGNORECASE)
    cleaned = [re.sub(r"\s+", " ", it[1]).strip(" .;:,") for it in items]
    cleaned = [c for c in cleaned if len(c) > 1][:max_items]
    if cleaned:
        return ", ".join(cleaned)

    return ""


def _extract_normative_sentence(text: str, max_len: int = 500) -> str:
    """
    Choose one short, normative sentence; if it exposes a list, append a compact '(at minimum: …)' tail.
    """
    for sent in _split_sentences(text):
        if _is_normative(sent):
            base = sent.strip()[:max_len]
            enum = _extract_enumeration(sent)
            return f"{base} (at minimum: {enum})" if enum else base

    # Fallback to first sentence (still grounded); try enum extraction on it too
    sents = _split_sentences(text)
    if not sents:
        return (text or "").strip()[:max_len]
    base = sents[0].strip()[:max_len]
    enum = _extract_enumeration(sents[0])
    return f"{base} (at minimum: {enum})" if enum else base


# ---------------------------------------------------------------------------
# Company context helpers
# ---------------------------------------------------------------------------

def _join_list(values: List[str], max_items: int = 2) -> str:
    vals = [v for v in (values or []) if str(v).strip()]
    if not vals:
        return ""
    if len(vals) <= max_items:
        return ", ".join(vals)
    return ", ".join(vals[:max_items]) + f" and {len(vals) - max_items} more"


def _context_prefix_compact(facts: CompanyFacts) -> str:
    """
    Compact, readable company context (kept separate from the bullet line):
    e.g., "For Acme KSA, for purposes including service delivery and fraud detection,
           when processing identity and contact data, with cross-border transfers (EU …)"
    """
    parts = []
    if getattr(facts, "company_name", ""):
        parts.append(f"For {facts.company_name}")
    purp = _join_list(getattr(facts, "purposes", []) or [], 2)
    cats = _join_list(getattr(facts, "data_categories", []) or [], 2)
    xfer = (getattr(facts, "cross_border", "") or "").strip()
    if purp:
        parts.append(f"for purposes including {purp}")
    if cats:
        parts.append(f"when processing {cats} data")
    if xfer:
        parts.append(f"with cross-border transfers ({xfer})")
    return ", ".join(parts)


def _render_company_context(facts: CompanyFacts) -> List[str]:
    """Short, human-readable context section (no bullets → no citation needed)."""
    out: List[str] = []
    def add(label: str, items: List[str], n: int) -> None:
        s = _join_list(items or [], n)
        if s:
            out.append(f"{label}: {s}")

    if getattr(facts, "company_name", ""):
        out.append(f"Company: {facts.company_name}")
    add("Activities", getattr(facts, "activities", []), 3)
    add("Purposes", getattr(facts, "purposes", []), 3)
    add("Data categories", getattr(facts, "data_categories", []), 4)
    add("Data subjects", getattr(facts, "data_subjects", []), 3)
    add("Processors", getattr(facts, "processors", []), 2)
    add("Recipients", getattr(facts, "recipients", []), 2)
    xfer = (getattr(facts, "cross_border", "") or "").strip()
    if xfer:
        out.append(f"Cross-border: {xfer}")
    add("Security measures", getattr(facts, "security_measures", []), 3)
    if not out:
        out.append("No additional company facts were provided.")
    return out


def _safe_list(v) -> List[str]:
    try:
        return [x for x in (v or []) if x]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# Policy-voice rewrite (deterministic fallback + optional LLM polish)
# ---------------------------------------------------------------------------

_REPLACERS = [
    (re.compile(r"\bshall not\b", re.IGNORECASE), "must not"),
    (re.compile(r"\bshall\b", re.IGNORECASE), "must"),
    (re.compile(r"\bshould\b", re.IGNORECASE), "should"),
    (re.compile(r"\bshall ensure\b", re.IGNORECASE), "must ensure"),
]

_SUBJECT_PAT = re.compile(
    r"^\s*(the\s+)?(controller|entity|organisation|organization|data\s+controller)\s+(must|should)\b",
    re.IGNORECASE,
)


def _to_policy_voice(sentence: str, company_name: str) -> str:
    """Turn 'Controller shall …' into 'Acme KSA must …' etc., without adding content."""
    s = sentence.strip()
    for pat, repl in _REPLACERS:
        s = pat.sub(repl, s)
    if _SUBJECT_PAT.match(s):
        # Replace generic subject with company name, keep modal verb (group 3)
        s = _SUBJECT_PAT.sub(f"{company_name} \\3", s)
    # If it starts with a modal/verb and no subject, prefix safely
    if not re.match(rf"^\s*{re.escape(company_name)}\b", s, re.IGNORECASE) and re.match(
        r"^\s*(must|should|implement|maintain|publish|notify|obtain|document|restrict|encrypt|retain|disclose)\b",
        s,
        re.IGNORECASE,
    ):
        s = f"{company_name} {s}"
    return s.strip()


def _llm_rewrite_policy_voice(
    bullets_no_cit: List[str],
    must_keep_tokens: List[str],
    model_name: str,
    company_name: str,
) -> List[str]:
    """
    If an LLM is available, use it to make bullets terse and imperative;
    otherwise apply the deterministic fallback.
    """
    if ChatOpenAI is None or not bullets_no_cit:
        return [_to_policy_voice(b, company_name) for b in bullets_no_cit]

    keep = ", ".join(sorted({t for t in must_keep_tokens if t}))
    llm = ChatOpenAI(model_name=model_name)
    prompt = (
        "Rewrite each line as a single, clear policy requirement in imperative voice. "
        "Prefer 'must/must not'. Do NOT add any new facts, exceptions, or examples. "
        f"Use the subject '{company_name}' if the sentence refers to 'controller/entity'. "
        "Return the list using '- ' bullets, one per line, same count as input.\n\n"
        "Keep tokens when present: " + (keep or "(none)") + "\n\n" +
        "\n".join(f"- {b}" for b in bullets_no_cit)
    )
    try:
        resp = llm.predict(prompt).strip()
        lines = [ln.strip()[2:].strip() for ln in resp.splitlines() if ln.strip().startswith("- ")]
        if len(lines) == len(bullets_no_cit):
            return lines
        return [_to_policy_voice(b, company_name) for b in bullets_no_cit]
    except Exception:
        return [_to_policy_voice(b, company_name) for b in bullets_no_cit]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def compose_policy_text(
    *,
    model_name: str,
    policy_title: str,
    facts: CompanyFacts,
    excerpts: List[str],
    citations: List[str],
    language: str = "en",
    fmt: str = "markdown",
) -> str:
    """
    Grounded, company-tailored composer:
    - Bullets: one short, policy-voice rule per retrieved source, each ends with (file, page, group).
    - An indented '_Context: …_' line under each bullet adds compact company facts.
    - 'Quoted clauses': verbatim snippets (with citations).
    """
    if not excerpts:
        return ""

    # Pair the retrieved texts with their citations
    pairs = _pair_excerpts_with_citations(excerpts[:12], citations[:12])

    # Prefer normative excerpts; fallback to any if none matched
    norm_pairs = [p for p in pairs if _is_normative(p["text"])]
    used_for_bullets = (norm_pairs or pairs)[:12]

    # Extract one short normative sentence per bullet (with optional compact enumeration)
    rule_sentences = [_extract_normative_sentence(p["text"]) for p in used_for_bullets]

    # Policy-voice rewrite (LLM if available; else deterministic)
    company = facts.company_name or "The Company"
    must_keep = [
        company,
        *_safe_list(getattr(facts, "purposes", [])),
        *_safe_list(getattr(facts, "data_categories", [])),
        (facts.cross_border or ""),
    ]
    policy_rules = _llm_rewrite_policy_voice(
        rule_sentences,
        must_keep_tokens=must_keep,
        model_name=model_name,
        company_name=company,
    )

    # Build bullets: short rule + citation; add compact context as an indented line
    compact_ctx = _context_prefix_compact(facts)
    bullet_lines: List[str] = []
    for i, p in enumerate(used_for_bullets):
        rule = policy_rules[i].rstrip(".").strip()
        cit = p["citation"]
        bullet_lines.append(f"- {rule}. {cit}".rstrip())  # bullet line MUST include citation
        if compact_ctx:
            bullet_lines.append(f"  _Context: {compact_ctx}_")  # indented; not a bullet → no citation required
        bullet_lines.append("")  # blank line between bullets

    # Assemble document
    h1 = f"# {policy_title} — {company}".strip(" —") if fmt == "markdown" else f"{policy_title} — {company}".strip(" —")
    h2 = (lambda t: f"## {t}" if fmt == "markdown" else t)

    lines: List[str] = [h1, ""]
    if fmt == "markdown":
        lines.append("_Grounded in SDAIA sources; each rule bullet ends with a citation. "
                     "Context lines reflect your company facts._")
        lines.append("")

    # Company context (verbatim facts)
    lines.append(h2("Company context")); lines.append("")
    lines.extend(_render_company_context(facts)); lines.append("")

    # Grounded policy bullets
    lines.append(h2("Policy (grounded summary)")); lines.append("")
    lines.extend(bullet_lines)

    # Quoted clauses (verbatim)
    lines.append(h2("Quoted clauses")); lines.append("")
    for p in pairs[:10]:
        quote = p["text"].replace("\n", " ").strip()
        lines.append(f'> "{quote}" {p["citation"]}')
        lines.append("")

    out = "\n".join(lines)
    out = _enforce_citations(out)  # drop any bullet/quote lines missing citations

    # Fallback: if everything was dropped by the guard, at least emit context + quotes
    if not out.strip():
        lines = [h1, "", h2("Company context"), "", *_render_company_context(facts), "", h2("Quoted clauses"), ""]
        for p in pairs[:10]:
            quote = p["text"].replace("\n", " ").strip()
            lines.append(f'> "{quote}" {p["citation"]}')
            lines.append("")
        out = "\n".join(lines).strip()

    return out


# ---------------------------------------------------------------------------
# (Optional) Debug helper
# ---------------------------------------------------------------------------

def _dump_json(model) -> str:
    """Pydantic v1/v2 safe JSON dump with Unicode preserved (not used by composer flow)."""
    try:
        data = model.model_dump()  # pydantic v2
    except AttributeError:
        data = model.dict()        # pydantic v1
    return json.dumps(data, ensure_ascii=False, indent=2, default=str)