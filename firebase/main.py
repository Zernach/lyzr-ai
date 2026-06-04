"""Firebase Cloud Functions entry point.

Two functions live here:

* ``api`` — HTTPS function. Direct ``https_fn`` handlers for the three
  endpoints the frontend hits (``/api/health``, ``/api/underwrite``,
  ``/api/jobs/{job_id}``). All they do is read/write Firestore, so they
  return in well under any edge timeout.

* ``process_job`` — Firestore-triggered function. Fires on every new doc in
  the ``underwriting_jobs/`` collection, runs the Lyzr agent synchronously
  (up to 540 s), and writes the parsed result back to the same doc.

The ``_backend/`` package is staged into this directory by
``scripts/deploy_backend.sh`` at deploy time (the script rsyncs
``backend/*.py`` and drops an empty ``__init__.py``). It is gitignored.

NOTE: the FastAPI app in ``backend/main.py`` is only used by the local dev
server. Production does NOT mount it via ``a2wsgi`` — that bridge (ASGI app
driven from inside the firebase-functions Flask wrapper) deadlocks on
Cloud Run and every request silently times out at 60 s. Keeping these
handlers as plain ``https_fn`` callables sidesteps that entire class of
issues.
"""
from __future__ import annotations

import json as _json
import os
import uuid

import firebase_admin
from firebase_admin import firestore as fb_firestore
from firebase_functions import firestore_fn, https_fn, options
from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from _backend.main import (
    JOBS_COLLECTION,
    LYZR_AGENT_ID,
    _build_message,
    _new_session_id,
    _parse_response,
    _run_agent,
)

if not firebase_admin._apps:  # type: ignore[attr-defined]
    firebase_admin.initialize_app()

options.set_global_options(
    region="us-central1",
    max_instances=10,
)

_CORS_ORIGINS = [
    "https://lyzr-ai-demo.web.app",
    "https://lyzr-ai-demo.firebaseapp.com",
    "http://localhost:5173",
    "https://lyzr.pages.dev",
    "https://lyzr.archlife.org",
    "https://api.lyzr.archlife.org",
]


APPLICANTS_COLLECTION = "applicants"


def _json_response(payload: dict, status: int = 200) -> https_fn.Response:
    return https_fn.Response(
        _json.dumps(payload),
        status=status,
        mimetype="application/json",
    )


def _stage_for_decision(decision: str, status: str) -> str:
    """Map an orchestrator decision/status onto a kanban column. Mirrors the
    TypeScript copy in frontend/src/db.ts (stageForDecision)."""
    s = (status or "").lower()
    if "conditional" in s:
        return "conditional"
    if decision == "YES":
        return "approved"
    if "manual" in s or "refer" in s:
        return "manual_review"
    return "declined"


@https_fn.on_request(
    secrets=["LYZR_API_KEY", "LYZR_AGENT_ID"],
    memory=options.MemoryOption.MB_512,
    cpu=1,
    concurrency=20,
    max_instances=5,
    timeout_sec=60,
    cors=options.CorsOptions(
        cors_origins=_CORS_ORIGINS,
        cors_methods=["get", "post", "options"],
    ),
)
def api(req: https_fn.Request) -> https_fn.Response:
    method = (req.method or "").upper()
    path = req.path or ""

    if method == "GET" and path == "/api/health":
        return _json_response({
            "status": "ok",
            "sdk": "lyzr-adk",
            "agent_id": os.getenv("LYZR_AGENT_ID", ""),
            "env": os.getenv("LYZR_ENV", "prod"),
            "configured": bool(os.getenv("LYZR_API_KEY") and os.getenv("LYZR_AGENT_ID")),
        })

    if method == "POST" and path == "/api/underwrite":
        body = req.get_json(silent=True) or {}
        rules = (body.get("rules") or "").strip()
        applicant = (body.get("applicant") or "").strip()
        if not rules or not applicant:
            return _json_response(
                {"detail": "Both rules and applicant data are required."},
                status=400,
            )
        job_id = uuid.uuid4().hex
        job_doc = {
            "status": "pending",
            "created_at": SERVER_TIMESTAMP,
            "rules": rules,
            "applicant": applicant,
        }
        # Optional kanban linkage — lets process_job move the card on finish.
        for src, dst in (
            ("applicant_id", "applicant_id"),
            ("rules_id", "rules_id"),
            ("created_by", "created_by"),
        ):
            val = (body.get(src) or "").strip()
            if val:
                job_doc[dst] = val
        fb_firestore.client().collection(JOBS_COLLECTION).document(job_id).set(job_doc)
        return _json_response({"job_id": job_id, "status": "pending"}, status=202)

    if method == "GET" and path.startswith("/api/jobs/"):
        job_id = path[len("/api/jobs/"):].strip("/")
        if not job_id:
            return _json_response({"detail": "Missing job_id."}, status=400)
        doc = fb_firestore.client().collection(JOBS_COLLECTION).document(job_id).get()
        if not doc.exists:
            return _json_response({"detail": "Job not found."}, status=404)
        data = doc.to_dict() or {}
        out: dict = {"status": data.get("status", "unknown")}
        if out["status"] == "done":
            out["result"] = data.get("result")
        elif out["status"] == "error":
            out["detail"] = data.get("detail", "Unknown error")
        return _json_response(out)

    return _json_response({"detail": "Not found."}, status=404)


@firestore_fn.on_document_created(
    document=f"{JOBS_COLLECTION}/{{job_id}}",
    secrets=["LYZR_API_KEY", "LYZR_AGENT_ID"],
    memory=options.MemoryOption.GB_1,
    cpu=1,
    max_instances=5,
    timeout_sec=540,
)
def process_job(event: firestore_fn.Event[firestore_fn.DocumentSnapshot | None]) -> None:
    if event.data is None:
        return
    data = event.data.to_dict() or {}
    if data.get("status") != "pending":
        return

    job_id = event.params["job_id"]
    client = fb_firestore.client()
    doc_ref = client.collection(JOBS_COLLECTION).document(job_id)
    doc_ref.update({"status": "running"})

    applicant_id = data.get("applicant_id")

    def _update_applicant(patch: dict) -> None:
        if not applicant_id:
            return
        try:
            client.collection(APPLICANTS_COLLECTION).document(applicant_id).update(
                {**patch, "updatedAt": SERVER_TIMESTAMP}
            )
        except Exception:  # noqa: BLE001 — linkage is best-effort
            pass

    try:
        message = _build_message(data["rules"], data["applicant"])
        session_id = _new_session_id(LYZR_AGENT_ID)
        raw = _run_agent(message, session_id)
        result = _parse_response(raw)
        doc_ref.update({"status": "done", "result": result.model_dump()})
        _update_applicant({
            "decision": result.decision,
            "decisionStatus": result.status,
            "decisionSummary": result.summary,
            "latestJobId": job_id,
            "stage": _stage_for_decision(result.decision, result.status),
        })
    except Exception as e:  # noqa: BLE001
        doc_ref.update({"status": "error", "detail": str(e)})
        _update_applicant({"stage": "manual_review"})
