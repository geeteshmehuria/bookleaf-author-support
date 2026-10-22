"""request_logs: what gets logged, what never does, and that logging can't break a request."""
from datetime import datetime, timezone

import pytest
from sqlalchemy import select

from app.core import request_log
from app.core.database import SessionLocal
from app.models import RequestLog
from app.services import tickets as ticket_service
from tests.test_auth import API, bearer, client, login

T = "[pytest]"


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    from sqlalchemy import delete
    from app.models import Ticket
    with SessionLocal() as db, db.begin():
        db.execute(delete(Ticket).where(Ticket.subject.startswith(T)))


@pytest.fixture
def since():
    return datetime.now(timezone.utc)


def rows_since(ts):
    with SessionLocal() as db:
        return db.scalars(select(RequestLog).where(RequestLog.start_on >= ts).order_by(RequestLog.start_on)).all()


def test_a_change_is_logged_with_user_route_and_input(since):
    token = login({"email": "farhan.sheikh@email.com", "password": "Author@123"})
    body = {"subject": f"{T} logged ticket", "description": "Checking that ticket creation is written to request_logs."}
    assert client.post(f"{API}/tickets", json=body, headers=bearer(token)).status_code == 201
    row = [r for r in rows_since(since) if r.request_method == "POST" and r.api_url == "/api/v1/tickets"][-1]
    assert (row.status_code, row.called_by) == (201, "AUTH008")
    assert row.input["subject"] == body["subject"]
    assert row.response is None and row.error is None
    assert row.duration_ms is not None and row.completed_on >= row.start_on


def test_failed_login_is_logged_without_the_password(since):
    client.post(f"{API}/auth/login", json={"email": "priya.sharma@email.com", "password": "MySecretGuess1"})
    [row] = [r for r in rows_since(since) if r.api_url == "/api/v1/auth/login"]
    assert row.status_code == 401 and row.called_by is None
    assert row.input == {"email": "priya.sharma@email.com", "password": "***"}
    assert row.error.startswith("INVALID_CREDENTIALS")
    assert "MySecretGuess1" not in str([row.input, row.error, row.request_url])


def test_successful_login_records_who(since):
    login({"email": "farhan.sheikh@email.com", "password": "Author@123"})
    [row] = [r for r in rows_since(since) if r.api_url == "/api/v1/auth/login"]
    assert row.called_by == "AUTH008" and row.input["password"] == "***"


def test_every_request_is_logged_by_default(since):
    token = login({"email": "farhan.sheikh@email.com", "password": "Author@123"})
    client.get(f"{API}/tickets?x=1", headers=bearer(token))  # a normal read, e.g. polling
    row = [r for r in rows_since(since) if r.request_method == "GET"][-1]
    assert (row.api_url, row.status_code, row.called_by) == ("/api/v1/tickets", 200, "AUTH008")
    assert row.input == {"x": "1"}  # query parameters are kept for reads


def test_options_and_health_are_never_logged(since):
    client.get(f"{API}/health")
    client.options(f"{API}/tickets", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert rows_since(since) == []


def test_a_failed_read_is_logged_with_its_route_template(since):
    token = login({"email": "farhan.sheikh@email.com", "password": "Author@123"})
    client.get(f"{API}/tickets/not-a-ticket", headers=bearer(token))
    row = [r for r in rows_since(since) if r.request_method == "GET"][-1]
    assert row.status_code == 404 and row.api_url == "/api/v1/tickets/{ticket_id}"
    assert row.error == "TICKET_NOT_FOUND: Ticket not found" and row.called_by == "AUTH008"


def test_a_rolled_back_request_is_still_logged(since, monkeypatch):
    token = login({"email": "farhan.sheikh@email.com", "password": "Author@123"})
    monkeypatch.setattr(ticket_service, "to_author_detail", lambda t: 1 / 0)
    body = {"subject": f"{T} crash", "description": "This request crashes after writing and is rolled back."}
    assert client.post(f"{API}/tickets", json=body, headers=bearer(token)).status_code == 500
    row = [r for r in rows_since(since) if r.api_url == "/api/v1/tickets"][-1]
    assert row.status_code == 500 and row.error == "INTERNAL_ERROR: ZeroDivisionError"


def test_large_bodies_are_noted_not_stored(since):
    token = login({"email": "farhan.sheikh@email.com", "password": "Author@123"})
    body = {"subject": f"{T} long one", "description": "x" * 4000}
    client.post(f"{API}/tickets", json=body, headers=bearer(token))
    row = [r for r in rows_since(since) if r.api_url == "/api/v1/tickets"][-1]
    assert list(row.input) == ["_note"] and "bytes" in row.input["_note"]


def test_logging_failure_never_breaks_the_request(monkeypatch):
    token = login({"email": "farhan.sheikh@email.com", "password": "Author@123"})

    def broken_session():
        raise RuntimeError("log database unavailable")

    monkeypatch.setattr(request_log, "SessionLocal", broken_session)
    body = {"subject": f"{T} log down", "description": "The request must succeed even if logging fails."}
    assert client.post(f"{API}/tickets", json=body, headers=bearer(token)).status_code == 201


def test_secret_keys_are_masked_at_any_depth():
    assert request_log._mask({"a": {"api_key": "k", "b": [{"Token": "t", "ok": 1}]}, "Password": "p"}) == {
        "a": {"api_key": "***", "b": [{"Token": "***", "ok": 1}]},
        "Password": "***",
    }
