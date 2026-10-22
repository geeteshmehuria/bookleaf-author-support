"""Phase 5 checks: admin queue, filters, overrides, notes, replies.

Writes only touch tickets created here ("[pytest]" subject), which are deleted afterwards.
"""
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import delete

from app.core.database import SessionLocal
from app.models import Ticket
from app.seed import seed_id
from tests.test_auth import API, assert_error, bearer, client, login

T = "[pytest]"
PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"]


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    with SessionLocal() as db, db.begin():
        db.execute(delete(Ticket).where(Ticket.subject.startswith(T)))


@pytest.fixture(scope="module")
def tok():
    return {
        "admin": login({"email": "neha.admin@bookleaf.example.com", "password": "Admin@123"}),
        "admin2": login({"email": "karan.admin@bookleaf.example.com", "password": "Admin@123"}),
        "sneha": login({"email": "sneha.kulkarni@email.com", "password": "Author@123"}),
    }


def admin_get(tok, path, **params):
    r = client.get(f"{API}/admin{path}", params=params, headers=bearer(tok["admin"]))
    assert r.status_code == 200, r.text
    return r.json()


def new_ticket(tok, subject="Need help with my royalty statement"):
    r = client.post(
        f"{API}/tickets",
        json={"subject": f"{T} {subject}", "description": "Please explain the numbers on my royalty statement."},
        headers=bearer(tok["sneha"]),
    )
    assert r.status_code == 201
    return r.json()


# --- Queue -----------------------------------------------------------------

def test_default_sort_is_unresolved_then_priority_then_oldest(tok):
    items = admin_get(tok, "/tickets")["items"]
    assert len(items) >= 6
    unresolved = [i for i in items if i["status"] in ("Open", "In Progress")]
    resolved = [i for i in items if i["status"] not in ("Open", "In Progress")]
    assert items[: len(unresolved)] == unresolved and items[len(unresolved):] == resolved
    ranks = [PRIORITY_ORDER.index(i["priority"]) for i in unresolved]
    assert ranks == sorted(ranks)


def test_row_has_queue_fields(tok):
    row = next(i for i in admin_get(tok, "/tickets")["items"] if i["id"] == str(seed_id("ticket-status-sneha")))
    assert row["author"] == {"id": "AUTH007", "name": "Sneha Kulkarni"}
    assert row["book"]["title"] == "Midnight in Mysore"
    assert row["assignee"]["id"] == "ADMIN001"
    assert row["waiting_on"] == "author"  # last message is from support
    assert row["overdue"] is False


@pytest.mark.parametrize(
    "params, check",
    [
        ({"status": "Closed"}, lambda i: i["status"] == "Closed"),
        ({"status": ["Open", "In Progress"]}, lambda i: i["status"] in ("Open", "In Progress")),
        ({"category": "Royalty & Payments"}, lambda i: i["category"] == "Royalty & Payments"),
        ({"priority": "High"}, lambda i: i["priority"] == "High"),
        ({"assigned": "unassigned"}, lambda i: i["assignee"] is None),
        ({"assigned": "me"}, lambda i: i["assignee"] and i["assignee"]["id"] == "ADMIN001"),
        ({"q": "sneha"}, lambda i: i["author"]["name"] == "Sneha Kulkarni"),
    ],
)
def test_filters(tok, params, check):
    items = admin_get(tok, "/tickets", **params)["items"]
    assert items, f"expected matches for {params}"
    assert all(check(i) for i in items)


def test_search_by_ticket_number(tok):
    t = new_ticket(tok)
    items = admin_get(tok, "/tickets", q=f"#{t['ticket_number']}")["items"]
    assert [i["id"] for i in items] == [t["id"]]


@pytest.mark.parametrize("q", ["#99999999999", "²"])
def test_odd_number_search_is_not_500(tok, q):
    r = client.get(f"{API}/admin/tickets", params={"q": q}, headers=bearer(tok["admin"]))
    assert r.status_code == 200


def test_date_range(tok):
    t = new_ticket(tok)
    today = date.today()
    in_range = admin_get(tok, "/tickets", created_from=str(today - timedelta(days=1)), created_to=str(today + timedelta(days=1)))
    before = admin_get(tok, "/tickets", created_to=str(today - timedelta(days=30)))
    assert t["id"] in {i["id"] for i in in_range["items"]}
    assert t["id"] not in {i["id"] for i in before["items"]}


def test_pagination(tok):
    page = admin_get(tok, "/tickets", limit=2, offset=0)
    assert len(page["items"]) == 2 and page["total"] >= 6 and page["limit"] == 2


def test_invalid_filter_value_is_422(tok):
    r = client.get(f"{API}/admin/tickets", params={"status": "Pending"}, headers=bearer(tok["admin"]))
    assert_error(r, 422, "VALIDATION_ERROR")


# --- Detail ----------------------------------------------------------------

def test_detail_has_notes_profile_and_book(tok):
    d = admin_get(tok, f"/tickets/{seed_id('ticket-status-sneha')}")
    assert [n["body"] for n in d["notes"]] == ["Checked with design team: first draft due Friday. Follow up if no update by then."]
    assert d["author_profile"]["email"] == "sneha.kulkarni@email.com" and d["author_profile"]["book_count"] == 3
    assert d["book_detail"]["id"] == "BK013" and d["book_detail"]["stage"] == "in_production"
    assert d["messages"][0]["sender"]["name"] == "Neha Verma"


def test_unknown_ticket_is_404(tok):
    r = client.get(f"{API}/admin/tickets/{uuid.uuid4()}", headers=bearer(tok["admin"]))
    assert_error(r, 404, "TICKET_NOT_FOUND")


# --- Update ----------------------------------------------------------------

def patch(tok, ticket_id, body, who="admin"):
    return client.patch(f"{API}/admin/tickets/{ticket_id}", json=body, headers=bearer(tok[who]))


def test_override_keeps_ai_suggestion(tok):
    t = new_ticket(tok)
    with SessionLocal() as db, db.begin():  # pretend the AI classified it
        row = db.get(Ticket, t["id"])
        row.ai_category, row.ai_priority = "Royalty & Payments", "High"
    r = patch(tok, t["id"], {"category": "General Inquiry", "priority": "Low"})
    assert r.status_code == 200
    d = r.json()
    assert (d["category"], d["priority"]) == ("General Inquiry", "Low")
    assert (d["ai_category"], d["ai_priority"]) == ("Royalty & Payments", "High")


def test_assign_and_unassign(tok):
    t = new_ticket(tok)
    assert patch(tok, t["id"], {"assigned_to": "ADMIN002"}).json()["assignee"]["id"] == "ADMIN002"
    assert patch(tok, t["id"], {"assigned_to": None}).json()["assignee"] is None


def test_cannot_assign_to_an_author(tok):
    t = new_ticket(tok)
    assert_error(patch(tok, t["id"], {"assigned_to": "AUTH001"}), 422, "INVALID_ASSIGNEE")


def test_empty_or_null_update_rejected(tok):
    t = new_ticket(tok)
    assert_error(patch(tok, t["id"], {}), 422, "NOTHING_TO_UPDATE")
    assert_error(patch(tok, t["id"], {"status": None}), 422, "VALIDATION_ERROR")


# --- The plan's Done-when: status + note + reply; author sees reply, not note -----

def test_admin_flow_author_sees_reply_but_not_note(tok):
    t = new_ticket(tok)
    tid = t["id"]
    note_text = "Internal: checked the payout file, Q3 batch delayed."
    reply_text = "Hi Sneha, your Q3 royalty is being processed and will reach you within 7 working days."

    client.post(f"{API}/admin/tickets/{tid}/notes", json={"body": note_text}, headers=bearer(tok["admin"]))
    r = client.post(f"{API}/admin/tickets/{tid}/replies", json={"body": reply_text}, headers=bearer(tok["admin"]))
    assert r.status_code == 201
    d = r.json()
    assert d["status"] == "In Progress"  # first reply moves Open -> In Progress
    assert d["assignee"]["id"] == "ADMIN001"  # replier owns an unassigned ticket
    assert d["waiting_on"] == "author"
    assert [n["body"] for n in d["notes"]] == [note_text]

    assert patch(tok, tid, {"status": "Resolved"}).json()["status"] == "Resolved"

    author_view = client.get(f"{API}/tickets/{tid}", headers=bearer(tok["sneha"]))
    assert author_view.status_code == 200
    a = author_view.json()
    assert a["status"] == "Resolved"
    assert [m["body"] for m in a["messages"]] == [reply_text]
    assert a["messages"][0]["sender_name"] == "Neha · BookLeaf Support"
    assert note_text not in author_view.text


def test_reply_does_not_steal_existing_assignment(tok):
    t = new_ticket(tok)
    patch(tok, t["id"], {"assigned_to": "ADMIN002"})
    r = client.post(f"{API}/admin/tickets/{t['id']}/replies", json={"body": "Looking into it."}, headers=bearer(tok["admin"]))
    assert r.json()["assignee"]["id"] == "ADMIN002"


def test_overdue_when_waiting_on_support_over_48h(tok):
    t = new_ticket(tok)
    with SessionLocal() as db, db.begin():
        row = db.get(Ticket, t["id"])
        row.created_at = row.created_at - timedelta(hours=60)
    row = admin_get(tok, f"/tickets/{t['id']}")
    assert row["overdue"] is True and row["waiting_hours"] >= 60
    client.post(f"{API}/admin/tickets/{t['id']}/replies", json={"body": "On it."}, headers=bearer(tok["admin"]))
    assert admin_get(tok, f"/tickets/{t['id']}")["overdue"] is False


def test_team_lists_admins_only(tok):
    assert {p["id"] for p in admin_get(tok, "/team")} == {"ADMIN001", "ADMIN002"}


# --- Access ----------------------------------------------------------------

@pytest.mark.parametrize("method, path", [("get", "/tickets"), ("get", "/team"), ("patch", f"/tickets/{uuid.uuid4()}")])
def test_author_gets_403_on_admin_routes(tok, method, path):
    r = getattr(client, method)(f"{API}/admin{path}", headers=bearer(tok["sneha"]), **({"json": {}} if method == "patch" else {}))
    assert_error(r, 403, "FORBIDDEN")
