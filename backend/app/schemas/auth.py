from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254, examples=["sneha.kulkarni@email.com"])
    # 72 = bcrypt's input limit. Longer passwords would be cut silently, so we refuse them.
    password: str = Field(min_length=1, max_length=72, examples=["Author@123"])

    @field_validator("email")
    @classmethod
    def normalise_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v:
            raise ValueError("Enter a valid email address")
        return v


class UserOut(BaseModel):
    """Public view of a user. Never includes password_hash, phone or city."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    role: Literal["author", "admin"] = Field(validation_alias="role_name")


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Seconds until the token expires")
    user: UserOut
