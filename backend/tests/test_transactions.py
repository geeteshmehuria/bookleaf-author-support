"""One transaction per request: all of a request's changes are saved together, or none are."""
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.core import database
from app.core.database import SessionLocal
from app.models import Ticket
from app.services import tickets as ticket_service
from tests.test_auth import API, bearer, client, login

T = "[pytest]"


def ticket_exists(subject: str) -> bool:
    with SessionLocal() as db:
        return db.scalar(select(Ticket.id).where(Ticket.subject == subject)) is not None


def raise_ticket(token: str, subject: str):
    body = {"subject": subject, "description": "Checking that failed requests leave nothing behind."}
    return client.post(f"{API}/tickets", json=body, headers=bearer(token))


def test_error_after_a_write_rolls_everything_back(monkeypatch):
    token = login({"email": "meera.nair@email.com", "password": "Author@123"})

    def broken_shaping(ticket):  # fails AFTER the ticket row was written (flushed)
        raise RuntimeError("bug while building the response")

    monkeypatch.setattr(ticket_service, "to_author_detail", broken_shaping)
    subject = f"{T} rollback on error"
    assert raise_ticket(token, subject).status_code == 500
    assert not ticket_exists(subject)  # the half-done request left nothing behind


def test_failed_commit_is_a_500_not_a_false_success(monkeypatch):
    token = login({"email": "meera.nair@email.com", "password": "Author@123"})

    class CommitFails(Session):
        def commit(self):
            raise RuntimeError("database went away during commit")

    monkeypatch.setattr(database, "SessionLocal", sessionmaker(bind=database.engine, class_=CommitFails, autoflush=False))
    subject = f"{T} commit fails"
    r = raise_ticket(token, subject)
    assert r.status_code == 500  # with FastAPI's default dependency scope this would have been 201
    assert not ticket_exists(subject)
