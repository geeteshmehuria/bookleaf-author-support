"""Ticket business logic used by the routers.

Routers stay thin (HTTP in, HTTP out); the rules live here so the admin side
(Phase 5) and the AI step (Phase 6) reuse the same functions.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import APIError
from app.models import Book, Ticket, TicketResponse, TicketStatus, User
from app.schemas.tickets import (
    AuthorTicketDetail,
    AuthorTicketSummary,
    ThreadMessageOut,
    TicketBookOut,
    TicketCreate,
)

SUPPORT_TEAM_NAME = "BookLeaf Support"


def now() -> datetime:
    return datetime.now(timezone.utc)


def parse_ticket_id(raw: str) -> uuid.UUID:
    """A malformed ID is treated like a missing ticket (404), not a validation error."""
    try:
        return uuid.UUID(raw)
    except ValueError:
        raise APIError(404, "TICKET_NOT_FOUND", "Ticket not found")


# --- Loading ---------------------------------------------------------------

def _with_thread():
    return (
        selectinload(Ticket.book),
        selectinload(Ticket.responses).selectinload(TicketResponse.sender).selectinload(User.role),
    )


def list_author_tickets(db: Session, author: User) -> list[Ticket]:
    """The author's own tickets, most recently active first."""
    return list(
        db.scalars(
            select(Ticket)
            .where(Ticket.author_id == author.id)
            .options(*_with_thread())
            .order_by(Ticket.updated_at.desc())
        )
    )


def get_author_ticket(db: Session, author: User, ticket_id: uuid.UUID) -> Ticket:
    """Another author's ticket gives the same 404 as one that doesn't exist."""
    ticket = db.scalar(
        select(Ticket).where(Ticket.id == ticket_id, Ticket.author_id == author.id).options(*_with_thread())
    )
    if ticket is None:
        raise APIError(404, "TICKET_NOT_FOUND", "Ticket not found")
    return ticket


# --- Changing --------------------------------------------------------------

def create_ticket(db: Session, author: User, data: TicketCreate) -> Ticket:
    if data.book_id is not None:
        owns_book = db.scalar(select(Book.id).where(Book.id == data.book_id, Book.author_id == author.id))
        if owns_book is None:
            # Same answer whether the book is someone else's or doesn't exist.
            raise APIError(422, "INVALID_BOOK", "Choose one of your books, or General / Account Level")

    ticket = Ticket(
        author_id=author.id,
        book_id=data.book_id,
        subject=data.subject,
        description=data.description,
        status=TicketStatus.OPEN,
        updated_at=now(),
        # category / priority use the DB defaults (General Inquiry / Medium) until
        # the AI classifies the ticket in the background (Phase 6).
    )
    db.add(ticket)
    db.commit()
    return get_author_ticket(db, author, ticket.id)


def add_author_reply(db: Session, author: User, ticket: Ticket, body: str) -> Ticket:
    """Author adds a message to their own ticket.

    Closed tickets are read-only. Replying to a Resolved ticket reopens it,
    because the author is saying the problem isn't solved.
    """
    if ticket.status == TicketStatus.CLOSED:
        raise APIError(409, "TICKET_CLOSED", "This ticket is closed. Please raise a new query.")
    db.add(TicketResponse(ticket_id=ticket.id, sender_id=author.id, body=body))
    if ticket.status == TicketStatus.RESOLVED:
        ticket.status = TicketStatus.OPEN
    ticket.updated_at = now()
    db.commit()
    db.expire(ticket)
    return get_author_ticket(db, author, ticket.id)


# --- Shaping for the author ------------------------------------------------

def _message_out(r: TicketResponse) -> ThreadMessageOut:
    from_support = r.sender.role_name == "admin"
    return ThreadMessageOut(
        id=r.id,
        body=r.body,
        created_at=r.created_at,
        from_support=from_support,
        # Authors see the team member's first name, e.g. "Neha · BookLeaf Support"
        sender_name=f"{r.sender.name.split()[0]} · {SUPPORT_TEAM_NAME}" if from_support else "You",
    )


def to_author_summary(t: Ticket) -> AuthorTicketSummary:
    last = t.responses[-1] if t.responses else None
    return AuthorTicketSummary(
        id=t.id,
        ticket_number=t.ticket_number,
        subject=t.subject,
        status=t.status,
        book=TicketBookOut.model_validate(t.book) if t.book else None,
        created_at=t.created_at,
        updated_at=t.updated_at,
        reply_count=len(t.responses),
        last_reply_from_support=bool(last and last.sender.role_name == "admin"),
    )


def to_author_detail(t: Ticket) -> AuthorTicketDetail:
    return AuthorTicketDetail(
        **to_author_summary(t).model_dump(),
        description=t.description,
        messages=[_message_out(r) for r in t.responses],
        can_reply=t.status != TicketStatus.CLOSED,
    )
