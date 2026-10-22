"""Ticket shapes for the ADMIN side. Kept apart from schemas/tickets.py (author side)
so admin-only fields (notes, priority, AI fields, assignee) can't leak by reuse."""
import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models import TicketCategory, TicketPriority, TicketStatus
from app.schemas.books import BookOut
from app.schemas.tickets import TicketBookOut

NoteBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5000)]

# BookLeaf's promise: a reply within 48 hours. A ticket waiting on us longer is overdue.
OVERDUE_AFTER_HOURS = 48


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str


class AdminTicketRow(BaseModel):
    """One row in the queue."""

    id: uuid.UUID
    ticket_number: int
    subject: str
    status: TicketStatus
    category: TicketCategory
    priority: TicketPriority
    ai_category: TicketCategory | None = Field(description="What the AI suggested; null = not classified")
    ai_priority: TicketPriority | None
    author: PersonOut
    book: TicketBookOut | None
    assignee: PersonOut | None
    created_at: datetime
    updated_at: datetime
    reply_count: int
    waiting_on: Literal["support", "author"] = Field(description="Who has to act next")
    waiting_hours: float = Field(description="Hours since the author last wrote (or since the ticket was raised)")
    overdue: bool = Field(description=f"Open / In Progress, waiting on support for over {OVERDUE_AFTER_HOURS} h")


class TicketPage(BaseModel):
    items: list[AdminTicketRow]
    total: int
    limit: int
    offset: int


class AuthorProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str
    phone: str | None
    city: str | None
    joined_date: datetime
    book_count: int


class AdminMessageOut(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime
    from_support: bool
    sender: PersonOut
    is_ai_drafted: bool


class NoteOut(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime
    admin: PersonOut


class AdminTicketDetail(AdminTicketRow):
    description: str
    ai_reasoning: str | None
    author_profile: AuthorProfileOut
    book_detail: BookOut | None = Field(description="Full book record for context (royalties, status)")
    messages: list[AdminMessageOut]
    notes: list[NoteOut] = Field(description="Internal only. Never shown to the author.")


class TicketUpdate(BaseModel):
    """Send only the fields to change. `assigned_to: null` unassigns."""

    status: TicketStatus | None = None
    category: TicketCategory | None = None
    priority: TicketPriority | None = None
    assigned_to: str | None = Field(default=None, description="An admin's user ID, or null to unassign")


class NoteCreate(BaseModel):
    body: NoteBody


class AdminReplyCreate(BaseModel):
    body: NoteBody
    is_ai_drafted: bool = Field(default=False, description="True if the admin started from the AI draft (Phase 6)")


class QueueFilters(BaseModel):
    """Parsed query parameters for GET /admin/tickets (built in the router)."""

    status: list[TicketStatus] | None = None
    category: list[TicketCategory] | None = None
    priority: list[TicketPriority] | None = None
    assigned: Literal["any", "me", "unassigned"] | str = "any"
    created_from: date | None = None
    created_to: date | None = None
    q: str | None = None
    sort: Literal["urgency", "oldest", "newest", "updated"] = "urgency"
    limit: int = 50
    offset: int = 0
