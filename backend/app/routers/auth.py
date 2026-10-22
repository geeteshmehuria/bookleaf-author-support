from fastapi import APIRouter, Depends, Request
from sqlalchemy import select

from app.core.database import DbSession
from app.core.deps import get_current_user
from app.core.errors import APIError
from app.core.rate_limit import LOGIN_FAILS_PER_ACCOUNT, LOGIN_FAILS_PER_IP, client_ip
from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.schemas.common import error_responses

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse, responses=error_responses(401, 422, 429))
def login(body: LoginRequest, request: Request, db: DbSession) -> TokenResponse:
    """Log in with email + password. Works for authors and admins; `user.role` says which.

    Copy `access_token` into Swagger's **Authorize** button to call protected routes.
    """
    ip = client_ip(request)
    account_key = f"{ip}:{body.email}"
    # Checked BEFORE the password, so a blocked caller can't keep testing passwords.
    LOGIN_FAILS_PER_ACCOUNT.check(account_key)
    LOGIN_FAILS_PER_IP.check(ip)

    user = db.scalar(select(User).where(User.email == body.email))

    # Always run one bcrypt check, even for an unknown email (see DUMMY_PASSWORD_HASH).
    password_ok = verify_password(body.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if user is None or not password_ok:
        LOGIN_FAILS_PER_ACCOUNT.record(account_key)
        LOGIN_FAILS_PER_IP.record(ip)
        # Same message for both cases: don't reveal which emails have accounts.
        raise APIError(401, "INVALID_CREDENTIALS", "Incorrect email or password")

    LOGIN_FAILS_PER_ACCOUNT.reset(account_key)  # a correct password clears earlier mistakes
    request.state.user_id = user.id  # for the request log (called_by)

    token, expires_in = create_access_token(user.id, user.role_name)
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut, responses=error_responses(401))
def me(user: User = Depends(get_current_user)) -> UserOut:
    """Who is logged in. The frontend calls this on page load to restore the session."""
    return UserOut.model_validate(user)
