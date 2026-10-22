from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.errors import APIError
from app.core.security import DUMMY_PASSWORD_HASH, create_access_token, verify_password
from app.models import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.schemas.common import error_responses

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login", response_model=TokenResponse, responses=error_responses(401, 422))
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Log in with email + password. Works for authors and admins; `user.role` says which.

    Copy `access_token` into Swagger's **Authorize** button to call protected routes.
    """
    user = db.scalar(select(User).where(User.email == body.email))

    # Always run one bcrypt check, even for an unknown email (see DUMMY_PASSWORD_HASH).
    password_ok = verify_password(body.password, user.password_hash if user else DUMMY_PASSWORD_HASH)
    if user is None or not password_ok:
        # Same message for both cases: don't reveal which emails have accounts.
        raise APIError(401, "INVALID_CREDENTIALS", "Incorrect email or password")

    token, expires_in = create_access_token(user.id, user.role_name)
    return TokenResponse(access_token=token, expires_in=expires_in, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut, responses=error_responses(401))
def me(user: User = Depends(get_current_user)) -> UserOut:
    """Who is logged in. The frontend calls this on page load to restore the session."""
    return UserOut.model_validate(user)
