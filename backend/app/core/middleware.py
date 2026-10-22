"""Request guards and security headers for every response."""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.errors import error_body

# Our largest field is 5,000 characters; 64 KB leaves plenty of room. Without this cap a client
# could send a huge JSON body that is read into memory before any field validation runs.
MAX_BODY_BYTES = 64 * 1024

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",  # browsers must not guess content types
    "X-Frame-Options": "DENY",  # API responses are never shown inside a frame
    "Referrer-Policy": "no-referrer",
}


def register_security_middleware(app: FastAPI) -> None:
    @app.middleware("http")
    async def guard_and_headers(request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
            return JSONResponse(status_code=413, content=error_body("PAYLOAD_TOO_LARGE", "Request body is too large"))

        response = await call_next(request)
        response.headers.update(SECURITY_HEADERS)
        if settings.ENVIRONMENT == "production":  # HTTPS only (local dev runs on plain http)
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response
