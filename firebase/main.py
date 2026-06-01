"""Firebase Cloud Functions entry point.

Wraps the FastAPI app (``backend/main.py``) as a single HTTPS function so the
existing routes (``/api/health``, ``/api/underwrite``) deploy verbatim to
Firebase. The FastAPI ASGI app is adapted to WSGI via ``a2wsgi``, then driven
by ``werkzeug.wrappers.Response.from_app`` using the Flask request environ
that ``firebase_functions`` hands us.

The ``_backend/`` package is staged into this directory by
``scripts/deploy_backend.sh`` at deploy time (the script rsyncs
``backend/*.py`` and drops an empty ``__init__.py``). It is gitignored.
"""
from __future__ import annotations

from a2wsgi import ASGIMiddleware
from firebase_functions import https_fn, options
from werkzeug.wrappers import Response

from _backend.main import app as _fastapi_app

options.set_global_options(
    region="us-central1",
    max_instances=10,
)

_wsgi_app = ASGIMiddleware(_fastapi_app)


@https_fn.on_request(
    secrets=["LYZR_API_KEY", "LYZR_AGENT_ID"],
    memory=options.MemoryOption.MB_512,
    timeout_sec=120,
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
