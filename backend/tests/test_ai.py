"""Phase 6 checks: classification, drafts, graceful failure, token-saving prompts.

Gemini is replaced by a fake (no API key or quota needed): each test says what the
fake returns or raises, and the tests check what our code does with it.
"""
from datetime import date
from types import SimpleNamespace

import pytest
from google.genai import errors
from sqlalchemy import delete, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import LlmLog, Ticket, TicketDraft
from app.services import llm
from app.services.ai_classifier import classify_by_rules
from app.services.ai_drafts import royalty_facts
from tests.test_auth import API, assert_error, bearer, client, login

T = "[pytest]"


# --- Fake Gemini -------------------------------------------------------------

class FakeGemini:
    def __init__(self):
        self.calls = []  # (model, user_prompt, config)
        self.replies = []  # queue: str (answer text) or Exception (raised)

    def __call__(self, model, contents, config):
        self.calls.append((model, contents, config))
        reply = self.replies.pop(0) if self.replies else '{"category": "General Inquiry", "priority": "Low", "reasoning": "default"}'
        if isinstance(reply, Exception):
            raise reply
        return SimpleNamespace(
            text=reply,
            parsed=None,  # make our code validate the raw JSON itself
            candidates=[SimpleNamespace(finish_reason=SimpleNamespace(name="STOP"))],
            usage_metadata=SimpleNamespace(prompt_token_count=420, candidates_token_count=60, total_token_count=480),
        )

    def system_of(self, i=-1):
        return self.calls[i][2].system_instruction


@pytest.fixture
def fake(monkeypatch):
    f = FakeGemini()
    monkeypatch.setattr(llm, "_generate", f)
    monkeypatch.setattr(llm, "RETRY_DELAY_SECONDS", 0)
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key-not-real-000000000")
    monkeypatch.setattr(settings, "GEMINI_MODEL", "draft-model")
    monkeypatch.setattr(settings, "GEMINI_CLASSIFY_MODEL", "cheap-model")
    return f


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    with SessionLocal() as db, db.begin():
        db.execute(delete(Ticket).where(Ticket.subject.startswith(T)))


@pytest.fixture(scope="module")
def tok():
    return {
        "admin": login({"email": "neha.admin@bookleaf.example.com", "password": "Admin@123"}),
        "ananya": login({"email": "ananya.reddy@email.com", "password": "Author@123"}),
        "sneha": login({"email": "sneha.kulkarni@email.com", "password": "Author@123"}),
    }


def new_ticket(tok, who="ananya", book_id="BK005", subject="Royalty never received", description=None):
    r = client.post(
        f"{API}/tickets",
        json={
            "book_id": book_id,
            "subject": f"{T} {subject}",
            "description": description or "I have not received any royalty since my book was published. Please check.",
        },
        headers=bearer(tok[who]),
    )
    assert r.status_code == 201, r.text
    return r.json()


def admin_view(tok, tid):
    return client.get(f"{API}/admin/tickets/{tid}", headers=bearer(tok["admin"])).json()


def logs_for(tid):
    with SessionLocal() as db:
        return db.scalars(select(LlmLog).where(LlmLog.ticket_id == tid).order_by(LlmLog.created_at)).all()


def server_error():
    return errors.ServerError(503, {"error": {"code": 503, "message": "overloaded", "status": "UNAVAILABLE"}})


def quota_error():
    return errors.ClientError(429, {"error": {"code": 429, "message": "quota", "status": "RESOURCE_EXHAUSTED"}})


# --- Classification ------------------------------------------------------------

def test_new_ticket_is_classified_by_ai(tok, fake):
    fake.replies = ['{"category": "Royalty & Payments", "priority": "High", "reasoning": "Royalty never paid."}']
    t = new_ticket(tok)
    d = admin_view(tok, t["id"])
    assert (d["category"], d["priority"]) == ("Royalty & Payments", "High")
    assert (d["ai_category"], d["ai_priority"], d["classified_by"]) == ("Royalty & Payments", "High", "ai")
    assert fake.calls[0][0] == "cheap-model"  # classification uses the cheaper model
    [log] = logs_for(t["id"])
    assert log.status.value == "success" and log.total_tokens == 480 and log.operation_type == "classify_priority"


def test_classification_prompt_is_small_and_has_no_contact_details(tok, fake):
    fake.replies = ['{"category": "Royalty & Payments", "priority": "High", "reasoning": "x"}']
    new_ticket(tok)
    prompt = fake.calls[0][1]
    assert "Between Two Temples" not in prompt  # book title not needed to classify
    assert "ananya.reddy@email.com" not in prompt and "+91" not in prompt and "Ananya" not in prompt
    assert "Rs 2,546" in prompt and "no royalty payout ever made" in prompt
    assert "<ticket>" in prompt  # author text is fenced as data


def test_invalid_ai_answer_falls_back_to_rules(tok, fake):
    fake.replies = ['{"category": "Refunds", "priority": "Urgent", "reasoning": "x"}']
    t = new_ticket(tok)
    d = admin_view(tok, t["id"])
    assert d["classified_by"] == "rules" and d["ai_category"] is None
    assert (d["category"], d["priority"]) == ("Royalty & Payments", "High")  # from keyword rules
    assert "outside the allowed list" in d["ai_reasoning"]


def test_quota_error_is_not_retried(tok, fake):
    fake.replies = [quota_error()]
    t = new_ticket(tok)
    assert len(fake.calls) == 1
    assert admin_view(tok, t["id"])["classified_by"] == "rules"
    assert logs_for(t["id"])[0].status.value == "rate_limited"


def test_server_error_is_retried_once(tok, fake):
    fake.replies = [server_error(), '{"category": "Royalty & Payments", "priority": "High", "reasoning": "x"}']
    t = new_ticket(tok)
    assert len(fake.calls) == 2
    assert admin_view(tok, t["id"])["classified_by"] == "ai"


def test_server_error_twice_falls_back(tok, fake):
    fake.replies = [server_error(), server_error()]
    t = new_ticket(tok)
    assert len(fake.calls) == 2
    assert admin_view(tok, t["id"])["classified_by"] == "rules"


def test_ai_not_configured_uses_rules_without_calling(tok, fake, monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "")
    t = new_ticket(tok, who="sneha", book_id="BK011", subject="Pages are blurry in my copies",
                   description="The author copies I received have blurry, misaligned pages.")
    assert fake.calls == []
    d = admin_view(tok, t["id"])
    assert (d["category"], d["priority"], d["classified_by"]) == ("Printing & Quality", "High", "rules")
    assert logs_for(t["id"])[0].status.value == "fallback"


def test_admin_rerun_applies_ai_answer(tok, fake):
    fake.replies = [quota_error(), '{"category": "Royalty & Payments", "priority": "Critical", "reasoning": "Long unpaid."}']
    t = new_ticket(tok)
    r = client.post(f"{API}/admin/tickets/{t['id']}/classify", headers=bearer(tok["admin"]))
    assert r.status_code == 200
    assert (r.json()["priority"], r.json()["classified_by"]) == ("Critical", "ai")


def test_admin_rerun_failure_is_503_and_changes_nothing(tok, fake):
    fake.replies = [quota_error(), quota_error()]
    t = new_ticket(tok)
    before = admin_view(tok, t["id"])
    assert_error(client.post(f"{API}/admin/tickets/{t['id']}/classify", headers=bearer(tok["admin"])), 503, "AI_UNAVAILABLE")
    after = admin_view(tok, t["id"])
    assert (after["category"], after["priority"]) == (before["category"], before["priority"])


def test_ai_never_overrules_an_admin_change(tok, fake):
    from app.services.ai_classifier import classify_ticket

    fake.replies = [quota_error()]
    t = new_ticket(tok)
    client.patch(f"{API}/admin/tickets/{t['id']}", json={"category": "General Inquiry", "priority": "Low"}, headers=bearer(tok["admin"]))
    fake.replies = ['{"category": "Royalty & Payments", "priority": "High", "reasoning": "x"}']
    with SessionLocal() as db:  # a late background run
        ticket = db.get(Ticket, t["id"])
        classify_ticket(db, ticket)
        db.commit()  # outside a request, the caller owns the transaction
    d = admin_view(tok, t["id"])
    assert (d["category"], d["priority"]) == ("General Inquiry", "Low")  # admin's choice kept
    assert d["ai_category"] == "Royalty & Payments"  # AI suggestion still recorded


@pytest.mark.parametrize(
    "subject, description, expected",
    [
        ("Wrong ISBN on Amazon", "The ISBN on Amazon differs from my copy", ("ISBN & Metadata Issues", "High")),
        ("Not on Flipkart", "My book is unavailable on Flipkart", ("Distribution & Availability", "Medium")),
        ("Typesetting delay", "It's been 3 weeks in typesetting", ("Book Status & Production Updates", "Medium")),
        ("Update my bio", "Can I update my author bio?", ("General Inquiry", "Low")),
        ("Royalty question", "How is my royalty calculated?", ("Royalty & Payments", "Medium")),
        ("No royalty for 6 months", "I haven't received any royalty for 6 months", ("Royalty & Payments", "High")),
        ("Copyright", "Someone is selling a copy of my book, I will contact a lawyer", ("General Inquiry", "Critical")),
    ],
)
def test_keyword_rules(subject, description, expected):
    category, priority, _ = classify_by_rules(subject, description)
    assert (category.value, priority.value) == expected


# --- Drafts ----------------------------------------------------------------------

def test_draft_is_generated_once_then_cached(tok, fake):
    fake.replies = [quota_error(), "Hi Ananya,\n\nI'm sorry...\n\nWarm regards,\nBookLeaf Author Support"]
    t = new_ticket(tok)
    first = client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()
    second = client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()
    assert first["available"] and not first["cached"] and first["text"].startswith("Hi Ananya")
    assert second["cached"] and second["text"] == first["text"]
    assert len(fake.calls) == 2  # 1 classify + 1 draft; the second GET made no call
    assert fake.calls[1][0] == "draft-model"


def test_regenerate_makes_a_new_draft(tok, fake):
    fake.replies = [quota_error(), "Draft one", "Draft two"]
    t = new_ticket(tok)
    client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    r = client.post(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()
    assert r["text"] == "Draft two"
    with SessionLocal() as db:
        assert db.scalar(select(TicketDraft.draft_text).where(TicketDraft.ticket_id == t["id"])) == "Draft two"


def test_draft_prompt_sends_only_what_is_needed(tok, fake):
    fake.replies = ['{"category": "Royalty & Payments", "priority": "High", "reasoning": "x"}', "draft"]
    t = new_ticket(tok)
    client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    system, user = fake.system_of(1), fake.calls[1][1]
    # only the royalty policy, not other categories' policies
    assert "80/20 split" in system and "re-sync" not in system and "free reprint" not in system
    # only this book; the author's first name but no contact details
    assert "Between Two Temples" in user and "Ananya" in user
    assert "ananya.reddy@email.com" not in user and "+91" not in user and "Hyderabad" not in user
    # real numbers and computed royalty facts
    assert "pending Rs 2,546" in user and "last payout never" in user
    assert "LIKELY OVERDUE" in user and "Today's date:" in user


def test_internal_notes_never_reach_the_ai(tok, fake):
    fake.replies = [quota_error(), "draft"]
    t = new_ticket(tok)
    client.post(f"{API}/admin/tickets/{t['id']}/notes", json={"body": "SECRET internal remark"}, headers=bearer(tok["admin"]))
    client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    assert all("SECRET internal remark" not in c[1] for c in fake.calls)


def test_draft_unavailable_is_200_and_manual_reply_still_works(tok, fake):
    fake.replies = [quota_error(), quota_error()]
    t = new_ticket(tok)
    r = client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    assert r.status_code == 200
    assert r.json() == {**r.json(), "available": False, "text": None}
    assert "quota" in r.json()["reason"]
    reply = client.post(f"{API}/admin/tickets/{t['id']}/replies", json={"body": "Manual reply"}, headers=bearer(tok["admin"]))
    assert reply.status_code == 201


def test_draft_marked_stale_after_author_writes_again(tok, fake):
    fake.replies = [quota_error(), "draft"]
    t = new_ticket(tok)
    client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    client.post(f"{API}/tickets/{t['id']}/replies", json={"body": "Any update?"}, headers=bearer(tok["ananya"]))
    assert client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()["stale"] is True


def test_long_threads_send_only_recent_messages(tok, fake):
    fake.replies = [quota_error(), "draft"]
    t = new_ticket(tok)
    for i in range(5):
        client.post(f"{API}/tickets/{t['id']}/replies", json={"body": f"follow-up number {i}"}, headers=bearer(tok["ananya"]))
    client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    user = fake.calls[-1][1]
    assert "follow-up number 0" not in user and "follow-up number 4" in user
    assert "2 earlier messages omitted" in user


def test_author_never_sees_ai_fields(tok, fake):
    fake.replies = ['{"category": "Royalty & Payments", "priority": "High", "reasoning": "secret reasoning"}']
    t = new_ticket(tok)
    r = client.get(f"{API}/tickets/{t['id']}", headers=bearer(tok["ananya"]))
    assert "secret reasoning" not in r.text and "High" not in r.text


# --- Royalty facts (computed in code, not by the model) --------------------------

def book(**kw):
    base = dict(royalty_pending=0, last_royalty_payout_date=None, publication_date=date(2024, 7, 5))
    return SimpleNamespace(**{**base, **kw})


def test_payout_dates_for_october_2026():
    facts = royalty_facts(book(royalty_pending=2546), date(2026, 10, 23))
    assert "Q3 2026 (Jul-Sep) are due by 14 Nov 2026" in facts[0]
    assert "Q4 2026 (Oct-Dec) by 14 Feb 2027" in facts[0]


def test_never_paid_above_threshold_is_overdue():
    assert "LIKELY OVERDUE" in royalty_facts(book(royalty_pending=2546), date(2026, 10, 23))[1]


def test_below_threshold_rolls_over():
    assert "rolls over" in royalty_facts(book(royalty_pending=850), date(2026, 10, 23))[1]


def test_recent_payout_is_not_overdue():
    f = royalty_facts(book(royalty_pending=3000, last_royalty_payout_date=date(2026, 8, 10)), date(2026, 10, 23))[1]
    assert "LIKELY OVERDUE" not in f and "14 Nov 2026" in f


def test_google_reason_is_shown_to_admin(tok, fake):
    overloaded = errors.ServerError(503, {"error": {"code": 503, "message": "The model is overloaded. Please try again later.", "status": "UNAVAILABLE"}})
    fake.replies = [quota_error(), overloaded, overloaded]
    t = new_ticket(tok)
    r = client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()
    assert r["available"] is False
    assert "503 UNAVAILABLE: The model is overloaded" in r["reason"]
    assert logs_for(t["id"])[-1].error_message == r["reason"]


# --- Context for specific replies ----------------------------------------------

def test_account_level_royalty_draft_gets_every_book(tok, fake):
    # General / Account level: no book picked, but the reply must still quote real numbers.
    fake.replies = ['{"category": "Royalty & Payments", "priority": "High", "reasoning": "x"}', "draft"]
    t = new_ticket(tok, who="sneha", book_id=None, subject="Where are my royalties?",
                   description="I have not received my royalty for a long time across my books. Please check.")
    classify_prompt = fake.calls[0][1]
    assert "Total royalty pending: Rs 7,865" in classify_prompt and "Algorithm of Love" not in classify_prompt
    client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    user = fake.calls[1][1]
    assert "The Algorithm of Love" in user and "Midnight in Mysore" in user
    assert "Total royalty pending across all books: Rs 7,865" in user and "LIKELY OVERDUE" in user
    assert "sneha.kulkarni@email.com" not in user and "Bangalore" not in user


def test_in_production_draft_names_the_stage(tok, fake):
    fake.replies = ['{"category": "Book Status & Production Updates", "priority": "Medium", "reasoning": "x"}', "draft"]
    t = new_ticket(tok, who="sneha", book_id="BK013", subject="When will my cover be ready?",
                   description="My book has been in cover design for weeks. When is the next step?")
    client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"]))
    user = fake.calls[1][1]
    assert "stage 3 of 9 (Cover Design); next: Typesetting" in user and "author's approval" in user


def test_category_change_drops_the_cached_draft(tok, fake):
    fake.replies = ['{"category": "General Inquiry", "priority": "Low", "reasoning": "x"}', "general draft", "royalty draft"]
    t = new_ticket(tok)
    assert client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()["text"] == "general draft"
    client.patch(f"{API}/admin/tickets/{t['id']}", json={"priority": "High"}, headers=bearer(tok["admin"]))
    assert client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()["cached"] is True
    client.patch(f"{API}/admin/tickets/{t['id']}", json={"category": "Royalty & Payments"}, headers=bearer(tok["admin"]))
    fresh = client.get(f"{API}/admin/tickets/{t['id']}/draft", headers=bearer(tok["admin"])).json()
    assert fresh["text"] == "royalty draft" and fresh["cached"] is False
    assert "80/20 split" in fake.system_of(-1)  # the new draft used the royalty policy
