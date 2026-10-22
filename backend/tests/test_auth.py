"""Phase 2 checks: login, token handling, role-based access, error format.

Needs the database running and seeded (python -m app.seed). Run from backend/:
    pytest -q
"""
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

API = settings.API_V1_STR
AUTHOR = {"email": "sneha.kulkarni@email.com", "password": "Author@123"}
ADMIN = {"email": "neha.admin@bookleaf.example.com", "password": "Admin@123"}
ORIGIN = "http://localhost:5173"

# raise_server_exceptions=False: see the 500 response a browser would get
client = TestClient(app, raise_server_exceptions=False)


def login(creds: dict) -> str:
    r = client.post(f"{API}/auth/login", json=creds)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def assert_error(r, status: int, code: str):
    assert r.status_code == status, r.text
    body = r.json()
    assert set(body) == {"error"}, body
    assert body["error"]["code"] == code
    assert body["error"]["message"]


@pytest.fixture(scope="module")
def author_token():
    return login(AUTHOR)


@pytest.fixture(scope="module")
def admin_token():
    return login(ADMIN)


# --- Login -----------------------------------------------------------------

def test_author_login_returns_token_and_user():
    r = client.post(f"{API}/auth/login", json=AUTHOR)
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    assert body["user"] == {"id": "AUTH007", "name": "Sneha Kulkarni", "email": AUTHOR["email"], "role": "author"}
    assert "password_hash" not in r.text


def test_admin_login_role_is_admin():
    r = client.post(f"{API}/auth/login", json=ADMIN)
    assert r.json()["user"]["role"] == "admin"


def test_email_is_case_and_space_insensitive():
    r = client.post(f"{API}/auth/login", json={"email": "  Sneha.Kulkarni@EMAIL.com ", "password": "Author@123"})
    assert r.status_code == 200


def test_wrong_password_gives_clear_message():
    r = client.post(f"{API}/auth/login", json={**AUTHOR, "password": "wrong"})
    assert_error(r, 401, "INVALID_CREDENTIALS")
    assert r.json()["error"]["message"] == "Incorrect email or password"


def test_unknown_email_gives_same_message_as_wrong_password():
    r = client.post(f"{API}/auth/login", json={"email": "nobody@email.com", "password": "Author@123"})
    assert_error(r, 401, "INVALID_CREDENTIALS")
    assert r.json()["error"]["message"] == "Incorrect email or password"


def test_missing_field_is_422_with_field_name():
    r = client.post(f"{API}/auth/login", json={"email": AUTHOR["email"]})
    assert_error(r, 422, "VALIDATION_ERROR")
    assert r.json()["error"]["details"][0]["field"] == "password"


def test_overlong_password_is_422_not_500():
    r = client.post(f"{API}/auth/login", json={**AUTHOR, "password": "x" * 100})
    assert_error(r, 422, "VALIDATION_ERROR")


# --- /auth/me and tokens ---------------------------------------------------

def test_me_with_token(author_token):
    r = client.get(f"{API}/auth/me", headers=bearer(author_token))
    assert r.status_code == 200
    assert r.json()["id"] == "AUTH007"


def test_no_token_is_401():
    r = client.get(f"{API}/auth/me")
    assert_error(r, 401, "NOT_AUTHENTICATED")
    assert r.headers["www-authenticate"] == "Bearer"


def test_garbage_token_is_401():
    assert_error(client.get(f"{API}/auth/me", headers=bearer("not.a.jwt")), 401, "INVALID_TOKEN")


def test_token_signed_with_other_secret_is_401():
    forged = jwt.encode(
        {"sub": "ADMIN001", "role": "admin", "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
        "attacker-secret-attacker-secret-attacker",
        algorithm="HS256",
    )
    assert_error(client.get(f"{API}/admin/summary", headers=bearer(forged)), 401, "INVALID_TOKEN")


def test_expired_token_is_401():
    expired = jwt.encode(
        {"sub": "AUTH007", "exp": datetime.now(timezone.utc) - timedelta(minutes=1)},
        settings.JWT_SECRET,
        algorithm=settings.JWT_ALGORITHM,
    )
    assert_error(client.get(f"{API}/auth/me", headers=bearer(expired)), 401, "TOKEN_EXPIRED")


def test_role_in_token_is_not_trusted(author_token):
    # An author's token edited to say role=admin (re-signed with the real secret, worst case)
    # is still refused: the role is read from the database, not the token.
    claims = jwt.decode(author_token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    tampered = jwt.encode({**claims, "role": "admin"}, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    assert_error(client.get(f"{API}/admin/summary", headers=bearer(tampered)), 403, "FORBIDDEN")


# --- Role-based access -----------------------------------------------------

def test_author_on_admin_route_is_403(author_token):
    assert_error(client.get(f"{API}/admin/summary", headers=bearer(author_token)), 403, "FORBIDDEN")


def test_no_token_on_admin_route_is_401():
    assert_error(client.get(f"{API}/admin/summary"), 401, "NOT_AUTHENTICATED")


def test_admin_on_admin_route_is_200(admin_token):
    r = client.get(f"{API}/admin/summary", headers=bearer(admin_token))
    assert r.status_code == 200
    body = r.json()
    assert set(body["by_status"]) == {"Open", "In Progress", "Resolved", "Closed"}
    assert sum(body["by_status"].values()) >= 6  # seeded tickets


# --- Error format everywhere -----------------------------------------------

def test_unknown_route_is_404_in_our_format():
    assert_error(client.get(f"{API}/does-not-exist"), 404, "NOT_FOUND")


def test_wrong_method_is_405_in_our_format():
    assert_error(client.get(f"{API}/auth/login"), 405, "METHOD_NOT_ALLOWED")


def test_unhandled_error_is_clean_500_with_cors_header():
    @app.get(f"{API}/_test_boom", include_in_schema=False)
    def boom():
        raise RuntimeError("secret internal detail")

    try:
        r = client.get(f"{API}/_test_boom", headers={"Origin": ORIGIN})
        assert_error(r, 500, "INTERNAL_ERROR")
        assert "secret internal detail" not in r.text
        # Without this header the browser hides the response and shows a CORS error instead
        assert r.headers.get("access-control-allow-origin") == ORIGIN
    finally:
        app.router.routes = [rt for rt in app.router.routes if getattr(rt, "path", "") != f"{API}/_test_boom"]


def test_error_responses_carry_cors_header():
    r = client.get(f"{API}/auth/me", headers={"Origin": ORIGIN})
    assert r.status_code == 401
    assert r.headers.get("access-control-allow-origin") == ORIGIN
