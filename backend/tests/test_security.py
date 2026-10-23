"""Rate limits, request-size guard, security headers, CORS and search escaping."""
import pytest
from sqlalchemy import delete

from app.core.database import SessionLocal
from app.core.rate_limit import AI_CALLS_PER_USER
from app.models import Ticket
from tests.test_ai import FakeGemini  # reuse the fake Gemini
from tests.test_auth import API, assert_error, bearer, client, login

T = "[pytest]"
ORIGIN = "http://localhost:5173"


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    with SessionLocal() as db, db.begin():
        db.execute(delete(Ticket).where(Ticket.subject.startswith(T)))


def try_login(email, password):
    return client.post(f"{API}/auth/login", json={"email": email, "password": password})


# --- Login rate limits -------------------------------------------------------

def test_sixth_wrong_password_is_blocked_even_with_the_right_one():
    for _ in range(5):
        assert try_login("priya.sharma@email.com", "wrong").status_code == 401
    blocked = try_login("priya.sharma@email.com", "Author@123")  # correct, but locked out for now
    assert_error(blocked, 429, "RATE_LIMITED")
    assert int(blocked.headers["retry-after"]) > 0
    # other accounts from the same network still work
    assert try_login("rohit.kapoor@email.com", "Author@123").status_code == 200


def test_correct_password_clears_earlier_mistakes():
    for _ in range(4):
        try_login("meera.nair@email.com", "wrong")
    assert try_login("meera.nair@email.com", "Author@123").status_code == 200
    for _ in range(4):
        try_login("meera.nair@email.com", "wrong")
    assert try_login("meera.nair@email.com", "Author@123").status_code == 200


def test_many_accounts_from_one_ip_is_blocked():
    for i in range(20):
        try_login(f"nobody{i}@email.com", "guess")
    assert_error(try_login("nobody-new@email.com", "guess"), 429, "RATE_LIMITED")


def test_unknown_email_is_rate_limited_like_a_real_one():
    # same behaviour for both, so the limit doesn't reveal which emails exist
    for _ in range(5):
        try_login("ghost@email.com", "x")
    assert_error(try_login("ghost@email.com", "x"), 429, "RATE_LIMITED")


# --- Ticket and AI limits -----------------------------------------------------

def test_sixth_ticket_in_ten_minutes_is_blocked():
    tok = login({"email": "farhan.sheikh@email.com", "password": "Author@123"})
    body = {"subject": f"{T} flood check", "description": "Testing the ticket rate limit for authors."}
    for _ in range(5):
        assert client.post(f"{API}/tickets", json=body, headers=bearer(tok)).status_code == 201
    r = client.post(f"{API}/tickets", json=body, headers=bearer(tok))
    assert_error(r, 429, "RATE_LIMITED")
    assert "several queries" in r.json()["error"]["message"]


def test_ai_limit_skips_the_call_and_falls_back(monkeypatch):
    from app.core.config import settings
    from app.services import llm

    fake = FakeGemini()
    monkeypatch.setattr(llm, "_generate", fake)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "draft-model")
    monkeypatch.setattr(AI_CALLS_PER_USER, "limit", 2)

    admin = login({"email": "neha.admin@bookleaf.example.com", "password": "Admin@123"})
    author = login({"email": "diya.chatterjee@email.com", "password": "Author@123"})
    tid = client.post(
        f"{API}/tickets", json={"subject": f"{T} ai limit", "description": "Testing the AI rate limit path here."},
        headers=bearer(author),
    ).json()["id"]
    calls_before = len(fake.calls)

    fake.replies = ["draft one", "draft two", "draft three"]
    r1 = client.post(f"{API}/admin/tickets/{tid}/draft", headers=bearer(admin)).json()
    r2 = client.post(f"{API}/admin/tickets/{tid}/draft", headers=bearer(admin)).json()
    r3 = client.post(f"{API}/admin/tickets/{tid}/draft", headers=bearer(admin)).json()
    assert r1["available"] and r2["available"]
    assert r3["available"] is False and "Too many AI requests" in r3["reason"]
    assert len(fake.calls) == calls_before + 2  # the third never reached Google


# --- Request guards and headers ----------------------------------------------

def test_huge_body_is_rejected_before_parsing():
    r = client.post(f"{API}/auth/login", content=b"x" * 100_000, headers={"Content-Type": "application/json"})
    assert_error(r, 413, "PAYLOAD_TOO_LARGE")


def test_security_headers_on_every_response():
    for r in (client.get(f"{API}/health"), client.get(f"{API}/auth/me")):
        assert r.headers["x-content-type-options"] == "nosniff"
        assert r.headers["x-frame-options"] == "DENY"
        assert "strict-transport-security" not in r.headers  # only in production (HTTPS)


def test_cors_allows_our_frontend_without_credentials():
    r = client.options(
        f"{API}/tickets",
        headers={"Origin": ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type"},
    )
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == ORIGIN
    assert "access-control-allow-credentials" not in r.headers


def test_cors_rejects_unknown_origin():
    r = client.options(f"{API}/tickets", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in r.headers


def test_search_wildcards_are_literal():
    admin = login({"email": "neha.admin@bookleaf.example.com", "password": "Admin@123"})
    for q in ("%", "_", "\\"):
        r = client.get(f"{API}/admin/tickets", params={"q": q, "status": "Open"}, headers=bearer(admin))
        assert r.status_code == 200 and r.json()["items"] == [], q
