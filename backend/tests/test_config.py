"""The settings refuse an unsafe JWT secret."""
import pytest
from pydantic import ValidationError

from app.core.config import EXAMPLE_JWT_SECRET, Settings

DB = "postgresql://u:p@localhost:5432/db"


def make(**env):
    # _env_file=None: judge only the values given here, not backend/.env
    return Settings(_env_file=None, DATABASE_URL=DB, **env)


def test_example_secret_refused_in_production():
    with pytest.raises(ValidationError, match="old example value"):
        make(JWT_SECRET=EXAMPLE_JWT_SECRET, ENVIRONMENT="production")


def test_example_secret_allowed_in_development():
    assert make(JWT_SECRET=EXAMPLE_JWT_SECRET, ENVIRONMENT="development").JWT_SECRET == EXAMPLE_JWT_SECRET


def test_short_secret_refused():
    with pytest.raises(ValidationError, match="at least 32 characters"):
        make(JWT_SECRET="too-short")
