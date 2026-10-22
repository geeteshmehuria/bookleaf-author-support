"""Shared response models. Used in route `responses=` so Swagger shows the error format."""
from pydantic import BaseModel


class ErrorDetail(BaseModel):
    field: str | None = None
    message: str


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorInfo


def error_responses(*codes: int) -> dict:
    """e.g. responses=error_responses(401, 403) on a route."""
    return {code: {"model": ErrorResponse} for code in codes}
