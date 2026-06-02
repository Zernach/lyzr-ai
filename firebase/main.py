"""Firebase Cloud Functions entry point.

Two functions live here:

* ``api`` — HTTPS function. Wraps the FastAPI app from ``_backend/main.py``
  via ``a2wsgi`` so the existing routes (``/api/health``, ``/api/underwrite``,
  ``/api/jobs/{job_id}``) deploy verbatim. The FastAPI handlers only touch
  Firestore — they never call the Lyzr SDK directly, so they return in well
  under any edge timeout.

* ``process_job`` — Firestore-triggered function. Fires on every new doc in
  the ``underwriting_jobs/`` collection, runs the Lyzr agent synchronously
  (up to 540 s), and writes the parsed result back to the same doc. This
  is what actually performs the underwriting work, decoupled from the HTTP
  request lifecycle.

The ``_backend/`` package is staged into this directory by
``scripts/deploy_backend.sh`` at deploy time (the script rsyncs
``backend/*.py`` and drops an empty ``__init__.py``). It is gitignored.
"""
from __future__ import annotations

import firebase_admin
from a2wsgi import ASGIMiddleware
from firebase_functions import firestore_fn, https_fn, options
from werkzeug.wrappers import Response

from _backend.main import (
    JOBS_COLLECTION,
    LYZR_AGENT_ID,
    _build_message,
    _new_session_id,
    _parse_response,
    _run_agent,
    app as _fastapi_app,
)

if not firebase_admin._apps:  # type: ignore[attr-defined]
    firebase_admin.initialize_app()

options.set_global_options(
    region="us-central1",
    max_instances=10,
)

_wsgi_app = ASGIMiddleware(_fastapi_app)


@https_fn.on_request(
    secrets=["LYZR_API_KEY", "LYZR_AGENT_ID"],
    memory=options.MemoryOption.GB_1,
    cpu=1,
    concurrency=10,
    max_instances=5,
    timeout_sec=60,
    cors=options.CorsOptions(
        cors_origins=[
            "https://lyzr-ai-demo.web.app",
            "https://lyzr-ai-demo.firebaseapp.com",
            "http://localhost:5173",
            "https://lyzr.pages.dev",
        ],
        cors_methods=["get", "post", "options"],
    ),
)
def api(req: https_fn.Request) -> https_fn.Response:
    return Response.from_app(_wsgi_app, req.environ)


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

    from firebase_admin import firestore as fb_firestore

    job_id = event.params["job_id"]
    doc_ref = fb_firestore.client().collection(JOBS_COLLECTION).document(job_id)
    doc_ref.update({"status": "running"})

    try:
        message = _build_message(data["rules"], data["applicant"])
        session_id = _new_session_id(LYZR_AGENT_ID)
        raw = _run_agent(message, session_id)
        result = _parse_response(raw)
        doc_ref.update({"status": "done", "result": result.model_dump()})
    except Exception as e:  # noqa: BLE001
        doc_ref.update({"status": "error", "detail": str(e)})
