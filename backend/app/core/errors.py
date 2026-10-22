"""One error format for the whole API:

    {"error": {"code": "FORBIDDEN", "message": "Admin access required"}}

Validation errors also list which fields failed:

    {"error": {"code": "VALIDATION_ERROR", "message": "...",
               "details": [{"field": "email", "message": "Field required"}]}}

The frontend only ever reads error.message, and never sees a raw stack trace.
"""
import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("bookleaf")

# Default code for each status, used when the raiser didn't give one.
STATUS_CODES = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_ERROR",
    503: "SERVICE_UNAVAILABLE",
}


class APIError(HTTPException):
    """Raise this in routes and dependencies: APIError(404, "TICKET_NOT_FOUND", "Ticket not found")."""

    def __init__(self, status_code: int, code: str, message: str, headers: dict | None = None):
        super().__init__(status_code=status_code, detail={"code": code, "message": message}, headers=headers)


def error_body(code: str, message: str, details: list | None = None) -> dict:
    body = {"code": code, "message": message}
    if details:
        body["details"] = details
    return {"error": body}


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    # Covers our APIError, plain HTTPException, and FastAPI's own 404 / 405 for unknown routes.
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        code, message = exc.detail["code"], exc.detail["message"]
    else:
        code = STATUS_CODES.get(exc.status_code, "ERROR")
        message = "Not found" if exc.status_code == 404 else str(exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, message),
        headers=getattr(exc, "headers", None),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for err in exc.errors():
        # loc looks like ("body", "email"); drop the "body"/"query" prefix for a readable field name
        loc = [str(p) for p in err.get("loc", []) if p not in ("body", "query", "path", "header")]
        msg = err.get("msg", "Invalid value").removeprefix("Value error, ")
        details.append({"field": ".".join(loc) or None, "message": msg})
    first = details[0] if details else {"field": None, "message": "Invalid request"}
    summary = f"{first['field']}: {first['message']}" if first["field"] else first["message"]
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder(error_body("VALIDATION_ERROR", summary, details)),
    )


def internal_error_response() -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content=error_body("INTERNAL_ERROR", "Something went wrong on our side. Please try again."),
    )


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    # Catch-all for bugs. Done as middleware, not add_exception_handler(Exception):
    # Starlette runs Exception handlers OUTSIDE the CORS middleware, so the browser
    # would see a CORS error instead of our message. main.py adds this before CORS,
    # so CORS wraps it and the 500 still carries CORS headers.
    @app.middleware("http")
    async def catch_unhandled_errors(request: Request, call_next):
        try:
            return await call_next(request)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            return internal_error_response()
