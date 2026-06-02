"""FastAPI backend for the Auto-Loan Underwriting dashboard.

Uses the official `lyzr-adk` Python SDK to call the Auto Loan Underwriting
Orchestrator agent (and its managed subagents), parses the structured
response, and returns a clean JSON payload for the dashboard.
"""

from __future__ import annotations

import asyncio
import os
import re
import secrets
import time
import uuid
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from lyzr import Studio
from pydantic import BaseModel, Field

# Lyzr's exception hierarchy. Wrapped in try/except so a future SDK refactor
# doesn't break import-time — we fall back to plain Exception.
try:
    from lyzr.exceptions import (  # type: ignore[attr-defined]
        AuthenticationError,
        LyzrError,
        NotFoundError,
        RateLimitError,
    )
except Exception:  # noqa: BLE001
    class LyzrError(Exception): ...          # type: ignore[no-redef]
    class AuthenticationError(LyzrError): ... # type: ignore[no-redef]
    class NotFoundError(LyzrError): ...       # type: ignore[no-redef]
    class RateLimitError(LyzrError): ...      # type: ignore[no-redef]


load_dotenv()

LYZR_API_KEY = os.getenv("LYZR_API_KEY", "")
LYZR_AGENT_ID = os.getenv("LYZR_AGENT_ID", "")
LYZR_USER_ID = os.getenv("LYZR_USER_ID", "underwriter@company.com")
LYZR_ENV = os.getenv("LYZR_ENV", "prod")

app = FastAPI(title="Auto-Loan Underwriting Copilot", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Schemas ────────────────────────────────────────────────────────────────

class UnderwriteRequest(BaseModel):
    rules: str = Field(..., description="Pasted underwriting rules & guidelines.")
    applicant: str = Field(..., description="Pasted applicant data.")


class UnderwriteResponse(BaseModel):
    decision: str  # "YES" | "NO"
    status: str   # raw orchestrator category
    summary: str
    subagent_findings: dict[str, str]
    missing_information: list[str]
    key_risk_factors: list[str]
    compensating_factors: list[str]
    adverse_action_reasons: list[str]
    recommended_next_step: str
    raw_response: str


# ─── SDK plumbing ───────────────────────────────────────────────────────────

_studio: Studio | None = None
_agent: Any | None = None


def _get_agent() -> Any:
    """Lazily fetch the orchestrator agent via Studio.get_agent(...) and
    cache it for the lifetime of the process."""
    global _studio, _agent
    if _agent is not None:
        return _agent
    if not LYZR_API_KEY or not LYZR_AGENT_ID:
        raise HTTPException(status_code=500, detail="Lyzr credentials not configured.")
    _studio = Studio(api_key=LYZR_API_KEY, env=LYZR_ENV, timeout=3600)
    _agent = _studio.get_agent(LYZR_AGENT_ID)
    return _agent


def _build_message(rules: str, applicant: str) -> str:
    return (
        "You are receiving an auto-loan underwriting case for evaluation. "
        "Run the full orchestrator workflow, coordinate the appropriate subagents, "
        "and respond in the structured output format defined in your instructions.\n\n"
        "=== UNDERWRITING RULES & GUIDELINES (policy text supplied by the underwriter) ===\n"
        f"{rules.strip()}\n\n"
        "=== APPLICANT DATA ===\n"
        f"{applicant.strip()}\n\n"
        "Return your response using the exact section headers from your instructions: "
        "Application Status, Summary, Subagent Findings (with each subagent on its own line), "
        "Missing Information, Key Risk Factors, Compensating Factors, "
        "Recommended Next Step, and Important Limitation."
    )


def _new_session_id(agent_id: str) -> str:
    return f"{agent_id}-{secrets.token_hex(5)}"


def _extract_text(resp: Any) -> str:
    """The SDK returns a response object; pull the text payload out of it."""
    for attr in ("response", "message", "output", "content", "text"):
        v = getattr(resp, attr, None)
        if isinstance(v, str) and v.strip():
            return v
    if isinstance(resp, str):
        return resp
    if isinstance(resp, dict):
        for key in ("response", "message", "output", "content", "text"):
            v = resp.get(key)
            if isinstance(v, str) and v.strip():
                return v
    return str(resp)


def _run_agent(message: str, session_id: str) -> str:
    agent = _get_agent()
    try:
        resp = agent.run(message, session_id=session_id)
    except AuthenticationError as e:
        raise HTTPException(status_code=502, detail=f"Lyzr auth failed: {e}") from e
    except NotFoundError as e:
        raise HTTPException(status_code=502, detail=f"Lyzr agent not found: {e}") from e
    except RateLimitError as e:
        raise HTTPException(status_code=502, detail=f"Lyzr rate-limited: {e}") from e
    except LyzrError as e:
        raise HTTPException(status_code=502, detail=f"Lyzr error: {e}") from e
    return _extract_text(resp)


# ─── Response parser ────────────────────────────────────────────────────────

_SECTION_HEADERS = [
    "Application Status",
    "Summary",
    "Subagent Findings",
    "Missing Information",
    "Key Risk Factors",
    "Compensating Factors",
    "Recommended Next Step",
    "Important Limitation",
]

_SUBAGENT_KEYS = [
    "Credit Risk",
    "Income and Affordability",
    "Vehicle and Loan-to-Value",
    "Policy Match",
    "Fair Lending and Compliance",
    "Adverse Action Reasons",
    "Manual Review Need",
]


def _split_sections(text: str) -> dict[str, str]:
    pattern = re.compile(
        r"(?:^|\n)\s*\**\s*("
        + "|".join(re.escape(h) for h in _SECTION_HEADERS)
        + r")\s*\**\s*:?\s*\n",
        re.IGNORECASE,
    )
    matches = list(pattern.finditer(text))
    sections: dict[str, str] = {}
    for i, m in enumerate(matches):
        header = next(
            (h for h in _SECTION_HEADERS if h.lower() == m.group(1).lower()),
            m.group(1),
        )
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        sections[header] = text[start:end].strip()
    return sections


def _bullets(text: str) -> list[str]:
    if not text:
        return []
    items: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        line = re.sub(r"^[\-\*•]\s*", "", line)
        line = re.sub(r"^\d+[\.\)]\s*", "", line)
        if line:
            items.append(line)
    if len(items) == 1 and len(text.splitlines()) == 1:
        return items
    return items


def _parse_subagents(block: str) -> tuple[dict[str, str], list[str]]:
    findings: dict[str, str] = {}
    adverse: list[str] = []
    if not block:
        return findings, adverse
    pattern = re.compile(
        r"(?:^|\n)\s*[\-\*•]?\s*\**\s*("
        + "|".join(re.escape(k) for k in _SUBAGENT_KEYS)
        + r")\s*\**\s*:\s*",
        re.IGNORECASE,
    )
    matches = list(pattern.finditer(block))
    for i, m in enumerate(matches):
        key = next((k for k in _SUBAGENT_KEYS if k.lower() == m.group(1).lower()), m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(block)
        body = block[start:end].strip()
        if key == "Adverse Action Reasons":
            adverse = _bullets(body)
        else:
            findings[key] = body
    return findings, adverse


def _classify(status: str) -> str:
    s = status.lower()
    if "preliminary approve" in s or s.strip() in {"approve", "approved"}:
        return "YES"
    if "conditional" in s:
        return "YES"
    return "NO"


def _parse_response(raw: str) -> UnderwriteResponse:
    sections = _split_sections(raw)

    status_block = sections.get("Application Status", "")
    status = status_block.splitlines()[0].strip() if status_block else ""
    status = re.sub(r"^\**\s*|\s*\**$", "", status).strip()

    subagent_findings, adverse_from_subagents = _parse_subagents(
        sections.get("Subagent Findings", "")
    )

    return UnderwriteResponse(
        decision=_classify(status),
        status=status or "Unknown",
        summary=sections.get("Summary", "").strip(),
        subagent_findings=subagent_findings,
        missing_information=_bullets(sections.get("Missing Information", "")),
        key_risk_factors=_bullets(sections.get("Key Risk Factors", "")),
        compensating_factors=_bullets(sections.get("Compensating Factors", "")),
        adverse_action_reasons=adverse_from_subagents,
        recommended_next_step=sections.get("Recommended Next Step", "").strip(),
        raw_response=raw,
    )


# ─── Job store (in-memory) ──────────────────────────────────────────────────
# The browser POSTs to /api/underwrite to start a job and then polls
# /api/jobs/{job_id} until the agent run finishes. This sidesteps the 100s
# Cloudflare edge timeout that killed the earlier streaming approach.

JOB_TTL_SECONDS = 3600
_JOBS: dict[str, dict[str, Any]] = {}


def _cleanup_jobs() -> None:
    now = time.time()
    for jid in [j for j, v in _JOBS.items() if now - v["created_at"] > JOB_TTL_SECONDS]:
        _JOBS.pop(jid, None)


async def _run_job(job_id: str, message: str, session_id: str) -> None:
    _JOBS[job_id]["status"] = "running"
    try:
        raw = await asyncio.to_thread(_run_agent, message, session_id)
        result = _parse_response(raw)
        _JOBS[job_id].update(status="done", result=result.model_dump())
    except HTTPException as e:
        _JOBS[job_id].update(status="error", detail=str(e.detail), http_status=e.status_code)
    except Exception as e:  # noqa: BLE001
        _JOBS[job_id].update(status="error", detail=str(e), http_status=500)


# ─── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "sdk": "lyzr-adk",
        "agent_id": LYZR_AGENT_ID,
        "env": LYZR_ENV,
        "configured": bool(LYZR_API_KEY and LYZR_AGENT_ID),
    }


@app.post("/api/underwrite", status_code=202)
async def underwrite(req: UnderwriteRequest) -> dict[str, str]:
    if not req.rules.strip() or not req.applicant.strip():
        raise HTTPException(status_code=400, detail="Both rules and applicant data are required.")

    _cleanup_jobs()
    job_id = uuid.uuid4().hex
    _JOBS[job_id] = {"status": "pending", "created_at": time.time()}

    message = _build_message(req.rules, req.applicant)
    session_id = _new_session_id(LYZR_AGENT_ID)
    asyncio.create_task(_run_job(job_id, message, session_id))

    return {"job_id": job_id, "status": "pending"}


@app.get("/api/jobs/{job_id}")
async def get_job(job_id: str) -> dict[str, Any]:
    job = _JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    out: dict[str, Any] = {"status": job["status"]}
    if job["status"] == "done":
        out["result"] = job["result"]
    elif job["status"] == "error":
        out["detail"] = job.get("detail", "Unknown error")
    return out
