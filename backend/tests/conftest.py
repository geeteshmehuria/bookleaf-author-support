import pytest
from sqlalchemy import delete, or_

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.rate_limit import ALL_LIMITERS
from app.models import LlmLog


@pytest.fixture(autouse=True)
def no_real_ai(monkeypatch):
    """Creating a ticket starts AI classification, which TestClient runs inline. Without this,
    a GEMINI_API_KEY in backend/.env would make every test run call (and pay for) the real API.
    Tests that exercise the AI install a fake Gemini on top of this (tests/test_ai.py)."""
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")


@pytest.fixture(autouse=True)
def fresh_rate_limits():
    """Each test starts with empty rate-limit counters, so tests don't trip each other's limits."""
    for limiter in ALL_LIMITERS:
        limiter.reset()


@pytest.fixture(scope="session", autouse=True)
def remove_test_ai_logs():
    """Test tickets are deleted by each test file; also drop the llm_logs rows they produced."""
    yield
    with SessionLocal() as db, db.begin():
        db.execute(delete(LlmLog).where(or_(LlmLog.user_prompt.contains("[pytest]"), LlmLog.user_prompt.contains("[e2e]"))))
