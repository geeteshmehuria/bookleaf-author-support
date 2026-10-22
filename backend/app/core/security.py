from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a password with bcrypt (a new random salt every time)."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plain password against a stored bcrypt hash.

    Returns False instead of raising for bad input (bcrypt refuses passwords
    over 72 bytes), so a strange password is just a failed login, never a 500.
    """
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


# A real bcrypt hash of a random string. When the email doesn't exist we still
# check the password against this, so a wrong email takes as long as a wrong
# password. Otherwise response time would reveal which emails are registered.
DUMMY_PASSWORD_HASH = hash_password("timing-equaliser-not-a-real-password")


# ---------------------------------------------------------------------------
# JWT access tokens
# ---------------------------------------------------------------------------

def create_access_token(user_id: str, role: str) -> tuple[str, int]:
    """Create a signed JWT. Returns (token, seconds until it expires).

    'role' is included only so the frontend can read it without an extra call.
    The backend never trusts it: every request re-reads the user's role from the DB.
    """
    expires_in = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role": role,
        "iat": now,
        "exp": now + timedelta(seconds=expires_in),
    }
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires_in


def decode_access_token(token: str) -> dict:
    """Verify signature and expiry. Raises jwt.ExpiredSignatureError / jwt.InvalidTokenError."""
    return jwt.decode(
        token,
        settings.JWT_SECRET,
        algorithms=[settings.JWT_ALGORITHM],  # fixed list: blocks the 'alg: none' trick
        options={"require": ["sub", "exp"]},
    )
