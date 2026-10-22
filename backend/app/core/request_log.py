"""Write a row to app.request_logs for every API request.

What is logged:     every request, including reads (polling adds ~12 rows a minute per open tab,
                    so in production old rows should be cleaned up on a schedule).
What is skipped:    CORS preflights (OPTIONS, sent by the browser itself) and /health
                    (uptime pings): neither is a user action.
What is never kept: passwords, tokens or other secrets in the input, and response bodies
                    (they hold royalty figures and emails that already live in their own tables).

The row is written in its OWN short transaction after the response is ready, so:
- a request that failed and rolled back still gets its log row (those are the ones you want)
- a logging problem can never break or roll back the request itself
"""
import json
import logging
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from starlette.concurrency import run_in_threadpool

from app.core.database import SessionLocal
from app.core.rate_limit import client_ip
from app.models import RequestLog

logger = logging.getLogger("bookleaf.requests")

MAX_STORED_INPUT = 2048  # bytes of request body kept; longer bodies are noted, not stored
SECRET_WORDS = ("password", "token", "secret", "authorization", "api_key")
WRITE_METHODS = {"POST", "PATCH", "PUT", "DELETE"}


def _mask(value):
    """Replace the value of any key that looks secret, at any depth."""
    if isinstance(value, dict):
        return {k: "***" if any(w in k.lower() for w in SECRET_WORDS) else _mask(v) for k, v in value.items()}
    if isinstance(value, list):
        return [_mask(v) for v in value]
    return value


def masked_input(request: Request, body: bytes) -> dict | None:
    if request.method not in WRITE_METHODS:
        params = dict(request.query_params)
        return _mask(params) if params else None
    if not body:
        return None
    if len(body) > MAX_STORED_INPUT:
        return {"_note": f"body not stored ({len(body)} bytes)"}
    try:
        return _mask(json.loads(body))
    except ValueError:
        return {"_note": "non-JSON body not stored"}


def should_log(method: str, path: str) -> bool:
    return method != "OPTIONS" and not path.endswith("/health")


def route_template(request: Request) -> str | None:
    """"/api/v1/tickets/{ticket_id}" for a request to /api/v1/tickets/06fa...; None if no route matched.

    Rebuilt from the URL because a router included with a prefix only knows its own part of
    the path. Grouping by template (not raw URL) makes "slowest / most failing endpoints" easy to query.
    """
    if "route" not in request.scope:
        return None
    by_value = {str(v): k for k, v in (request.scope.get("path_params") or {}).items()}
    return "/".join(f"{{{by_value[seg]}}}" if seg in by_value else seg for seg in request.url.path.split("/"))


def _write(row: dict) -> None:
    try:
        with SessionLocal() as db, db.begin():
            db.add(RequestLog(**row))
    except Exception:  # a logging failure must never affect the request
        logger.exception("Could not write request_logs row")


def register_request_logging(app: FastAPI) -> None:
    @app.middleware("http")
    async def log_request(request: Request, call_next):
        started_at = datetime.now(timezone.utc)
        t0 = time.perf_counter()
        # Read the body up front (Starlette replays it to the route). The size guard in
        # middleware.py runs before this, so it is at most 64 KB.
        body = await request.body() if request.method in WRITE_METHODS else b""

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - t0) * 1000, 2)
        if should_log(request.method, request.url.path):
            query = f"?{request.url.query}" if request.url.query else ""
            row = {
                "request_method": request.method,
                "request_url": (request.url.path + query)[:500],
                "api_url": route_template(request),
                "status_code": response.status_code,
                "input": masked_input(request, body),
                "response": None,  # never stored, see module docstring
                "error": getattr(request.state, "error", None),
                "ip": client_ip(request),
                "user_agent": (request.headers.get("user-agent") or "")[:300] or None,
                "called_by": getattr(request.state, "user_id", None),
                "duration_ms": duration_ms,
                "start_on": started_at,
                "completed_on": datetime.now(timezone.utc),
            }
            await run_in_threadpool(_write, row)  # DB driver is synchronous: keep it off the event loop
        return response
