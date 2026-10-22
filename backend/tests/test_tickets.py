"""Phase 4 checks: authors create and read only their own tickets; notes never leak.

Tickets created here have subjects starting with "[pytest]" and are deleted
afterwards, so running the tests doesn't litter the demo database.
"""
import pytest
from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.models import Ticket, TicketStatus
from app.seed import seed_id
from tests.test_auth import API, assert_error, bearer, client, login

PW = "Author@123"
T = "[pytest]"


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    with SessionLocal() as db, db.begin():
        db.execute(delete(Ticket).where(Ticket.subject.startswith(T)))


@pytest.fixture(scope="module")
def tokens():
    return {
        "priya": login({"email": "priya.sharma@email.com", "password": PW}),
        "sneha": login({"email": "sneha.kulkarni@email.com", "password": PW}),
        "ananya": login({"email": "ananya.reddy@email.com", "password": PW}),
        "admin": login({"email": "neha.admin@bookleaf.example.com", "password": "Admin@123"}),
    }


def create(token, **body):
    payload = {"subject": f"{T} Royalty question", "description": "My royalty for last quarter has not arrived yet.", **body}
    return client.post(f"{API}/tickets", json=payload, headers=bearer(token))


# --- Create ----------------------------------------------------------------

def test_create_general_ticket(tokens):
    r = create(tokens["priya"], book_id=None)
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["status"] == "Open"
    assert t["book"] is None
    assert t["messages"] == [] and t["can_reply"] is True
    assert isinstance(t["ticket_number"], int)


def test_empty_book_id_means_general(tokens):
    r = create(tokens["priya"], book_id="")
    assert r.status_code == 201 and r.json()["book"] is None


def test_create_ticket_for_own_book(tokens):
    r = create(tokens["priya"], book_id="BK001")
    assert r.status_code == 201
    assert r.json()["book"] == {"id": "BK001", "title": "Whispers of the Ganges"}


def test_cannot_create_ticket_for_another_authors_book(tokens):
    # BK003 belongs to Rohit
    assert_error(create(tokens["priya"], book_id="BK003"), 422, "INVALID_BOOK")
    assert_error(create(tokens["priya"], book_id="BK999"), 422, "INVALID_BOOK")


@pytest.mark.parametrize(
    "body, field",
    [
        ({"subject": "Hi"}, "subject"),
        ({"subject": "      "}, "subject"),
        ({"subject": "x" * 151}, "subject"),
        ({"description": "too short"}, "description"),
        ({"description": " " * 50}, "description"),
    ],
)
def test_validation_errors_name_the_field(tokens, body, field):
    r = create(tokens["priya"], **body)
    assert_error(r, 422, "VALIDATION_ERROR")
    assert r.json()["error"]["details"][0]["field"] == field


def test_text_is_trimmed(tokens):
    r = create(tokens["priya"], subject=f"   {T} trimmed subject   ")
    assert r.json()["subject"] == f"{T} trimmed subject"


# --- Read ------------------------------------------------------------------

def test_list_shows_only_own_tickets(tokens):
    mine = client.get(f"{API}/tickets", headers=bearer(tokens["ananya"])).json()
    assert mine, "Ananya has a seeded ticket"
    assert all(t["subject"] != "Update my author bio on the BookLeaf store" for t in mine)  # Priya's
    ids = {t["id"] for t in mine}
    priya_ids = {t["id"] for t in client.get(f"{API}/tickets", headers=bearer(tokens["priya"])).json()}
    assert not ids & priya_ids


def test_cannot_open_another_authors_ticket(tokens):
    sneha_ticket = str(seed_id("ticket-status-sneha"))
    other = client.get(f"{API}/tickets/{sneha_ticket}", headers=bearer(tokens["priya"]))
    assert_error(other, 404, "TICKET_NOT_FOUND")
    assert_error(client.get(f"{API}/tickets/not-a-uuid", headers=bearer(tokens["priya"])), 404, "TICKET_NOT_FOUND")


def test_thread_shows_support_reply_but_never_internal_notes(tokens):
    r = client.get(f"{API}/tickets/{seed_id('ticket-status-sneha')}", headers=bearer(tokens["sneha"]))
    assert r.status_code == 200
    t = r.json()
    assert t["status"] == "In Progress"
    assert t["book"]["title"] == "Midnight in Mysore"
    [msg] = t["messages"]
    assert msg["from_support"] is True and msg["sender_name"] == "Neha · BookLeaf Support"
    # The seeded internal note on this ticket must not appear anywhere
    assert "design team: first draft due Friday" not in r.text
    for hidden in ("notes", "priority", "ai_category", "ai_priority", "assigned_to", "is_ai_drafted"):
        assert hidden not in t


# --- Replies ---------------------------------------------------------------

def test_author_can_reply(tokens):
    t = create(tokens["sneha"]).json()
    r = client.post(f"{API}/tickets/{t['id']}/replies", json={"body": "Here are more details."}, headers=bearer(tokens["sneha"]))
    assert r.status_code == 201
    [msg] = r.json()["messages"]
    assert msg == {**msg, "from_support": False, "sender_name": "You", "body": "Here are more details."}


def test_reply_reopens_a_resolved_ticket(tokens):
    t = create(tokens["sneha"]).json()
    with SessionLocal() as db, db.begin():
        db.get(Ticket, t["id"]).status = TicketStatus.RESOLVED
    r = client.post(f"{API}/tickets/{t['id']}/replies", json={"body": "Still not fixed."}, headers=bearer(tokens["sneha"]))
    assert r.json()["status"] == "Open"


def test_cannot_reply_to_closed_ticket(tokens):
    t = create(tokens["sneha"]).json()
    with SessionLocal() as db, db.begin():
        db.get(Ticket, t["id"]).status = TicketStatus.CLOSED
    r = client.post(f"{API}/tickets/{t['id']}/replies", json={"body": "Hello?"}, headers=bearer(tokens["sneha"]))
    assert_error(r, 409, "TICKET_CLOSED")


def test_cannot_reply_to_another_authors_ticket(tokens):
    r = client.post(
        f"{API}/tickets/{seed_id('ticket-status-sneha')}/replies", json={"body": "hi"}, headers=bearer(tokens["priya"])
    )
    assert_error(r, 404, "TICKET_NOT_FOUND")


def test_empty_reply_rejected(tokens):
    t = create(tokens["sneha"]).json()
    r = client.post(f"{API}/tickets/{t['id']}/replies", json={"body": "   "}, headers=bearer(tokens["sneha"]))
    assert_error(r, 422, "VALIDATION_ERROR")


# --- Access ----------------------------------------------------------------

def test_admin_gets_403_on_author_ticket_routes(tokens):
    assert_error(client.get(f"{API}/tickets", headers=bearer(tokens["admin"])), 403, "FORBIDDEN")


def test_no_token_is_401():
    assert_error(client.get(f"{API}/tickets"), 401, "NOT_AUTHENTICATED")


def test_cleanup_marker_used():
    # Guard: nothing above should create a ticket without the [pytest] prefix
    with SessionLocal() as db:
        stray = db.scalars(select(Ticket.subject).where(Ticket.subject.ilike("%royalty question%"))).all()
        assert all(s.startswith(T) for s in stray)
