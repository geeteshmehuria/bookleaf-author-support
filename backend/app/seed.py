"""Load sample data into the database.

Run from inside backend/:
    python -m app.seed                    # normal run
    python -m app.seed --reset-passwords  # also reset every seeded user's password to the demo one

What it does:
1. Creates the tables from ../schema.sql if they don't exist yet
   (Docker does this locally; a hosted DB like Render's starts empty).
2. Loads the 10 authors and 18 books from data/bookleaf_sample_data.json.
3. Creates one login per author and two admin logins.
4. Adds 6 sample tickets (one per category) in different states, so the admin
   queue is not empty on first look.

Safe to run more than once:
- authors and books are upserted (the JSON file is the source of truth)
- existing users keep their password (unless --reset-passwords); only name/contact fields are refreshed
- sample tickets, replies and notes use fixed IDs and are skipped if present,
  so changes made during a demo are not overwritten

It never calls the AI. Sample tickets have their category and priority written
by hand, so the demo looks complete even when the Gemini quota is used up.
"""
import json
import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import hash_password
from app.models import (
    Book,
    InternalNote,
    Role,
    Ticket,
    TicketCategory as Cat,
    TicketPriority as Pri,
    TicketResponse,
    TicketStatus as St,
    User,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_FILE = REPO_ROOT / "schema.sql"
DATA_FILE = REPO_ROOT / "data" / "bookleaf_sample_data.json"

# Demo passwords. The JSON has no passwords, so we set them here and list them
# in the README. Override with env vars if the live demo needs different ones.
AUTHOR_PASSWORD = os.getenv("SEED_AUTHOR_PASSWORD", "Author@123")
ADMIN_PASSWORD = os.getenv("SEED_ADMIN_PASSWORD", "Admin@123")
RESET_PASSWORDS = "--reset-passwords" in sys.argv

ADMINS = [
    {"id": "ADMIN001", "name": "Neha Verma", "email": "neha.admin@bookleaf.example.com"},
    {"id": "ADMIN002", "name": "Karan Mehta", "email": "karan.admin@bookleaf.example.com"},
]

# Fixed namespace so the same seed key always gives the same UUID.
SEED_NS = uuid.UUID("6f1c2b8e-1d2a-4c47-9a51-2b0d3f6a9e10")


def seed_id(key: str) -> uuid.UUID:
    return uuid.uuid5(SEED_NS, key)


def ensure_schema() -> None:
    """Run schema.sql only if the tables don't exist yet."""
    with engine.connect() as conn:
        exists = conn.execute(text("SELECT to_regclass('app.users')")).scalar()
    if exists:
        print("Schema: already exists, skipping schema.sql")
        return
    sql = SCHEMA_FILE.read_text(encoding="utf-8")
    # psycopg2 can run a file with many statements in one execute() call
    raw = engine.raw_connection()
    try:
        with raw.cursor() as cur:
            cur.execute(sql)
        raw.commit()
    finally:
        raw.close()
    print("Schema: created from schema.sql")


def role_ids(db: Session) -> dict[str, int]:
    return {r.name: r.id for r in db.scalars(select(Role))}


def upsert_user(db: Session, values: dict) -> None:
    """Insert a user; if the id exists, refresh profile fields but keep the password
    (unless --reset-passwords was passed)."""
    update_cols = ["name", "email", "phone", "city", "role_id", "joined_date"]
    if RESET_PASSWORDS:
        update_cols.append("password_hash")
    stmt = insert(User).values(**values)
    stmt = stmt.on_conflict_do_update(
        index_elements=[User.id],
        set_={k: stmt.excluded[k] for k in update_cols if k in values},
    )
    db.execute(stmt)


def to_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def seed_authors_and_books(db: Session, roles: dict[str, int]) -> None:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    for a in data["authors"]:
        upsert_user(
            db,
            {
                "id": a["author_id"],
                "name": a["name"],
                "email": a["email"].lower(),
                # Hashed per user: each gets its own salt, so the stored hashes
                # differ even though the demo password is the same.
                "password_hash": hash_password(AUTHOR_PASSWORD),
                "role_id": roles["author"],
                "phone": a.get("phone"),
                "city": a.get("city"),
                "joined_date": datetime.combine(to_date(a["joined_date"]), datetime.min.time(), timezone.utc),
            },
        )
        for b in a["books"]:
            values = {
                "id": b["book_id"],
                "author_id": a["author_id"],
                "title": b["title"],
                "isbn": b.get("isbn"),
                "genre": b.get("genre"),
                "publication_date": to_date(b.get("publication_date")),
                "status": b["status"],
                "mrp": b.get("mrp"),
                "author_royalty_per_copy": b.get("author_royalty_per_copy"),
                "total_copies_sold": b.get("total_copies_sold") or 0,
                "total_royalty_earned": b.get("total_royalty_earned") or 0,
                "royalty_paid": b.get("royalty_paid") or 0,
                "royalty_pending": b.get("royalty_pending") or 0,
                "last_royalty_payout_date": to_date(b.get("last_royalty_payout_date")),
                "print_partner": b.get("print_partner"),
                "available_on": b.get("available_on") or [],
            }
            stmt = insert(Book).values(**values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[Book.id],
                set_={k: stmt.excluded[k] for k in values if k != "id"},
            )
            db.execute(stmt)


def seed_admins(db: Session, roles: dict[str, int]) -> None:
    for adm in ADMINS:
        upsert_user(
            db,
            {**adm, "password_hash": hash_password(ADMIN_PASSWORD), "role_id": roles["admin"]},
        )


def sample_tickets(now: datetime) -> list[dict]:
    """Six tickets, one per category, spread over all four statuses.

    Each uses the real numbers of the book it is about. One ticket (#5) shows an
    admin override: the AI said Medium, the admin changed it to Low.
    """
    ago = lambda **kw: now - timedelta(**kw)  # noqa: E731
    return [
        {
            "key": "ticket-royalty-ananya",
            "author_id": "AUTH003", "book_id": "BK005",
            "subject": "Royalty for Between Two Temples never received",
            "description": (
                "My dashboard shows Rs 2,546 earned for Between Two Temples, but I have not received a "
                "single payout since the book went live in July 2024. Can you tell me when this will be paid?"
            ),
            "status": St.OPEN, "category": Cat.ROYALTY, "priority": Pri.HIGH,
            "ai_category": Cat.ROYALTY, "ai_priority": Pri.HIGH,
            "ai_reasoning": "Author reports royalty never received on a live book with pending balance; payment issues are high priority.",
            "assigned_to": None, "created_at": ago(days=4, hours=2), "updated_at": ago(days=4, hours=2),
        },
        {
            "key": "ticket-isbn-rohit",
            "author_id": "AUTH002", "book_id": "BK004",
            "subject": "Wrong ISBN showing on Amazon listing",
            "description": (
                "The Amazon India page for my book shows an ISBN that does not match the one on my "
                "copyright page. Readers are asking me if it's a different edition. Please fix this."
            ),
            "status": St.OPEN, "category": Cat.ISBN_METADATA, "priority": Pri.HIGH,
            "ai_category": Cat.ISBN_METADATA, "ai_priority": Pri.HIGH,
            "ai_reasoning": "ISBN mismatch on a retailer listing; the knowledge base treats ISBN errors as at least High.",
            "assigned_to": None, "created_at": ago(hours=6), "updated_at": ago(hours=6),
        },
        {
            "key": "ticket-status-sneha",
            "author_id": "AUTH007", "book_id": "BK013",
            "subject": "When will the cover design be ready?",
            "description": (
                "My third book has been in cover design for a while now. Could you share an expected "
                "date for the first cover draft and the next steps after that?"
            ),
            "status": St.IN_PROGRESS, "category": Cat.BOOK_STATUS, "priority": Pri.MEDIUM,
            "ai_category": Cat.BOOK_STATUS, "ai_priority": Pri.MEDIUM,
            "ai_reasoning": "Production timeline question with no financial or quality impact.",
            "assigned_to": "ADMIN001", "created_at": ago(days=2), "updated_at": ago(days=1, hours=20),
        },
        {
            "key": "ticket-print-vikram",
            "author_id": "AUTH004", "book_id": "BK007",
            "subject": "Blurry pages in my author copies",
            "description": (
                "I ordered 20 author copies and pages 45 to 60 are blurry in about half of them. "
                "I have an event next week and can't hand these out."
            ),
            "status": St.RESOLVED, "category": Cat.PRINTING_QUALITY, "priority": Pri.HIGH,
            "ai_category": Cat.PRINTING_QUALITY, "ai_priority": Pri.HIGH,
            "ai_reasoning": "Print defect affecting physical copies with a near-term event; quality problems are High.",
            "assigned_to": "ADMIN002", "created_at": ago(days=6), "updated_at": ago(days=3),
        },
        {
            "key": "ticket-general-priya",
            "author_id": "AUTH001", "book_id": None,
            "subject": "Update my author bio on the BookLeaf store",
            "description": (
                "I'd like to update the author bio shown on my BookLeaf Store page. "
                "I won a regional literary award this year and want to mention it."
            ),
            "status": St.CLOSED, "category": Cat.GENERAL, "priority": Pri.LOW,
            "ai_category": Cat.GENERAL, "ai_priority": Pri.MEDIUM,
            "ai_reasoning": "Account-level profile change request, not tied to a specific book.",
            "assigned_to": "ADMIN001", "created_at": ago(days=9), "updated_at": ago(days=8),
        },
        {
            "key": "ticket-distribution-diya",
            "author_id": "AUTH010", "book_id": "BK018",
            "subject": "Book not available on Flipkart",
            "description": (
                "My newest book is live on Amazon and the BookLeaf Store but I can't find it on Flipkart. "
                "Is Flipkart listing part of my package?"
            ),
            "status": St.OPEN, "category": Cat.DISTRIBUTION, "priority": Pri.MEDIUM,
            "ai_category": Cat.DISTRIBUTION, "ai_priority": Pri.MEDIUM,
            "ai_reasoning": "Availability question about one retail channel; no sales currently blocked on other channels.",
            "assigned_to": None, "created_at": ago(days=1, hours=3), "updated_at": ago(days=1, hours=3),
        },
    ]


def sample_thread(now: datetime) -> tuple[list[dict], list[dict]]:
    """Replies (visible to authors) and internal notes (admin only) for the seeded tickets."""
    t = seed_id
    responses = [
        {
            "key": "resp-sneha-1", "ticket_id": t("ticket-status-sneha"), "sender_id": "ADMIN001",
            "body": (
                "Hi Sneha, thanks for checking in. Your book is with our cover design team now. "
                "We'll share the first cover draft with you within 48 hours, and you'll get two rounds of changes after that."
            ),
            "created_at": now - timedelta(days=1, hours=20),
        },
        {
            "key": "resp-vikram-1", "ticket_id": t("ticket-print-vikram"), "sender_id": "ADMIN002",
            "body": (
                "Hi Vikram, we're sorry about this. This was a fault at our printing stage, not yours. "
                "We've sent 20 replacement copies by express courier; they should reach you in 3 working days."
            ),
            "created_at": now - timedelta(days=5),
        },
        {
            "key": "resp-vikram-2", "ticket_id": t("ticket-print-vikram"), "sender_id": "AUTH004",
            "body": "Received the new copies today and they look perfect. Thank you!",
            "created_at": now - timedelta(days=3, hours=1),
        },
        {
            "key": "resp-priya-1", "ticket_id": t("ticket-general-priya"), "sender_id": "ADMIN001",
            "body": "Hi Priya, congratulations on the award! Your updated bio is now live on the BookLeaf Store.",
            "created_at": now - timedelta(days=8),
        },
    ]
    notes = [
        {
            "key": "note-sneha-1", "ticket_id": t("ticket-status-sneha"), "admin_id": "ADMIN001",
            "body": "Checked with design team: first draft due Friday. Follow up if no update by then.",
            "created_at": now - timedelta(days=1, hours=21),
        },
        {
            "key": "note-vikram-1", "ticket_id": t("ticket-print-vikram"), "admin_id": "ADMIN002",
            "body": "In-House print batch issue on BK007. Raised with print floor; reprint cost on us.",
            "created_at": now - timedelta(days=5, hours=1),
        },
    ]
    return responses, notes


def insert_if_missing(db: Session, model, rows: list[dict]) -> int:
    """Insert rows with fixed ids; skip any that already exist. Returns how many were new."""
    added = 0
    for row in rows:
        values = {k: v for k, v in row.items() if k != "key"}
        values["id"] = seed_id(row["key"])
        result = db.execute(
            insert(model).values(**values).on_conflict_do_nothing(index_elements=[model.id])
        )
        added += result.rowcount
    return added


def print_summary(db: Session) -> None:
    count = lambda q: db.scalar(select(func.count()).select_from(q))  # noqa: E731
    roles = role_ids(db)
    print("\nDatabase now has:")
    print(f"  authors (users with role=author): {count(select(User).where(User.role_id == roles['author']).subquery())}")
    print(f"  admins  (users with role=admin):  {count(select(User).where(User.role_id == roles['admin']).subquery())}")
    print(f"  books:            {count(Book)}")
    print(f"  tickets:          {count(Ticket)}")
    print(f"  ticket responses: {count(TicketResponse)}")
    print(f"  internal notes:   {count(InternalNote)}")
    print("\nTest logins:")
    print(f"  any author email from the JSON (e.g. priya.sharma@email.com) / {AUTHOR_PASSWORD}")
    for adm in ADMINS:
        print(f"  {adm['email']} / {ADMIN_PASSWORD}")


def main() -> None:
    ensure_schema()
    now = datetime.now(timezone.utc)
    with SessionLocal() as db, db.begin():  # one transaction: all or nothing
        roles = role_ids(db)
        seed_authors_and_books(db, roles)
        seed_admins(db, roles)
        new_tickets = insert_if_missing(db, Ticket, sample_tickets(now))
        responses, notes = sample_thread(now)
        new_responses = insert_if_missing(db, TicketResponse, responses)
        new_notes = insert_if_missing(db, InternalNote, notes)
    if RESET_PASSWORDS:
        print("Passwords: reset to the demo passwords for all seeded users")
    print(
        f"Seed: authors/books/admins upserted; "
        f"{new_tickets} new tickets, {new_responses} new replies, {new_notes} new notes"
    )
    with SessionLocal() as db:
        print_summary(db)


if __name__ == "__main__":
    main()
