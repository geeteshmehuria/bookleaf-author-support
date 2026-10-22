"""FastAPI dependencies for authentication and role checks.

Usage in a router:
    @router.get("/books")
    def my_books(user: User = Depends(require_author)): ...

    @router.get("/admin/tickets")
    def queue(admin: User = Depends(require_admin)): ...

Rule: anything that depends on "who is asking" (which author's books, which
tickets) comes from the user returned here, never from an ID in the request.
"""
import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import APIError
from app.core.security import decode_access_token
from app.models import User

# auto_error=False: we raise our own 401 with our error format.
# HTTPBearer also adds the "Authorize" button to Swagger (/api/v1/docs).
bearer_scheme = HTTPBearer(auto_error=False, description="Paste the access_token from POST /auth/login")

# RFC 6750: a 401 should tell the client which auth scheme to use.
WWW_AUTH = {"WWW-Authenticate": "Bearer"}


def _unauthorized(code: str, message: str) -> APIError:
    return APIError(401, code, message, headers=WWW_AUTH)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Return the logged-in user, or 401. Protects every non-public route."""
    if credentials is None:
        raise _unauthorized("NOT_AUTHENTICATED", "Please log in to continue")

    try:
        payload = decode_access_token(credentials.credentials)
    except jwt.ExpiredSignatureError:
        raise _unauthorized("TOKEN_EXPIRED", "Your session has expired. Please log in again")
    except jwt.InvalidTokenError:
        raise _unauthorized("INVALID_TOKEN", "Invalid login session. Please log in again")

    # Load the user fresh from the DB on every request, so a deleted user or a
    # changed role takes effect immediately, not when the token expires.
    user = db.get(User, payload["sub"])
    if user is None:
        raise _unauthorized("INVALID_TOKEN", "This account no longer exists")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Logged in AND an admin, else 403."""
    if user.role_name != "admin":
        raise APIError(403, "FORBIDDEN", "Admin access required")
    return user


def require_author(user: User = Depends(get_current_user)) -> User:
    """Logged in AND an author, else 403. Admins have no books or tickets of their own."""
    if user.role_name != "author":
        raise APIError(403, "FORBIDDEN", "Author access required")
    return user
