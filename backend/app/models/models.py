"""SQLAlchemy models that mirror schema.sql.

schema.sql is the source of truth: it creates the tables, enums, constraints and
indexes. These classes only describe the tables so Python code can query them.
Nothing here calls create_all().
"""
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import Boolean, Date, FetchedValue, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    LlmLogStatus,
    TicketCategory,
    TicketPriority,
    TicketStatus,
    llm_log_status_enum,
    ticket_category_enum,
    ticket_priority_enum,
    ticket_status_enum,
)

SCHEMA = {"schema": "app"}
TZ = TIMESTAMP(timezone=True)
NOW = text("CURRENT_TIMESTAMP")
UUID_DEFAULT = text("gen_random_uuid()")


class Role(Base):
    __tablename__ = "roles"
    __table_args__ = SCHEMA

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True)  # 'author' | 'admin'
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)


class User(Base):
    """Authors (AUTH001..) and admins (ADMIN001..) share this table; role_id tells them apart."""

    __tablename__ = "users"
    __table_args__ = SCHEMA

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role_id: Mapped[int] = mapped_column(ForeignKey("app.roles.id"))
    phone: Mapped[Optional[str]] = mapped_column(Text)
    city: Mapped[Optional[str]] = mapped_column(Text)
    joined_date: Mapped[datetime] = mapped_column(TZ, server_default=NOW)

    role: Mapped[Role] = relationship(lazy="joined")
    books: Mapped[list["Book"]] = relationship(back_populates="author")

    @property
    def role_name(self) -> str:
        return self.role.name


class Book(Base):
    __tablename__ = "books"
    __table_args__ = SCHEMA

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    author_id: Mapped[str] = mapped_column(ForeignKey("app.users.id"))
    title: Mapped[str] = mapped_column(Text)
    isbn: Mapped[Optional[str]] = mapped_column(Text, unique=True)
    genre: Mapped[Optional[str]] = mapped_column(Text)
    publication_date: Mapped[Optional[date]] = mapped_column(Date)  # NULL while in production
    status: Mapped[str] = mapped_column(Text)
    mrp: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))  # NULL while in production
    author_royalty_per_copy: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))  # NULL while in production
    total_copies_sold: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    total_royalty_earned: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    royalty_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    royalty_pending: Mapped[Decimal] = mapped_column(Numeric(12, 2), server_default=text("0"))
    last_royalty_payout_date: Mapped[Optional[date]] = mapped_column(Date)  # NULL = never paid
    print_partner: Mapped[Optional[str]] = mapped_column(Text)
    available_on: Mapped[list[str]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)

    author: Mapped[User] = relationship(back_populates="books")


class Ticket(Base):
    __tablename__ = "tickets"
    __table_args__ = SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=UUID_DEFAULT)
    # SERIAL in schema.sql: the database fills it in, so we never send it.
    ticket_number: Mapped[int] = mapped_column(Integer, unique=True, server_default=FetchedValue())
    author_id: Mapped[str] = mapped_column(ForeignKey("app.users.id"))
    # NULL = "General / Account Level". schema.sql also has a composite FK
    # (book_id, author_id) -> books, so a ticket can't point at another author's book.
    book_id: Mapped[Optional[str]] = mapped_column(String(50))
    subject: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[TicketStatus] = mapped_column(ticket_status_enum, server_default=text("'Open'"))

    # Active values (AI suggestion, or admin override)
    category: Mapped[TicketCategory] = mapped_column(ticket_category_enum, server_default=text("'General Inquiry'"))
    priority: Mapped[TicketPriority] = mapped_column(ticket_priority_enum, server_default=text("'Medium'"))

    # What the AI suggested, kept so the admin can see what was overridden.
    # NULL = AI has not classified it (failed, or not run yet).
    ai_category: Mapped[Optional[TicketCategory]] = mapped_column(ticket_category_enum)
    ai_priority: Mapped[Optional[TicketPriority]] = mapped_column(ticket_priority_enum)
    ai_reasoning: Mapped[Optional[str]] = mapped_column(Text)

    assigned_to: Mapped[Optional[str]] = mapped_column(ForeignKey("app.users.id"))
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)
    updated_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)

    author: Mapped[User] = relationship(foreign_keys=[author_id])
    assignee: Mapped[Optional[User]] = relationship(foreign_keys=[assigned_to])
    book: Mapped[Optional[Book]] = relationship(
        primaryjoin="Ticket.book_id == Book.id", foreign_keys=[book_id], viewonly=True
    )
    responses: Mapped[list["TicketResponse"]] = relationship(
        back_populates="ticket", order_by="TicketResponse.created_at"
    )
    # Admin-only. Author-facing schemas must never include this.
    notes: Mapped[list["InternalNote"]] = relationship(
        back_populates="ticket", order_by="InternalNote.created_at"
    )


class TicketResponse(Base):
    """The conversation thread. Visible to both the author and admins."""

    __tablename__ = "ticket_responses"
    __table_args__ = SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=UUID_DEFAULT)
    ticket_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app.tickets.id", ondelete="CASCADE"))
    sender_id: Mapped[str] = mapped_column(ForeignKey("app.users.id"))
    body: Mapped[str] = mapped_column(Text)
    is_ai_drafted: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)

    ticket: Mapped[Ticket] = relationship(back_populates="responses")
    sender: Mapped[User] = relationship()


class InternalNote(Base):
    """Private admin notes. Never returned by author endpoints."""

    __tablename__ = "internal_notes"
    __table_args__ = SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=UUID_DEFAULT)
    ticket_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app.tickets.id", ondelete="CASCADE"))
    admin_id: Mapped[str] = mapped_column(ForeignKey("app.users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)

    ticket: Mapped[Ticket] = relationship(back_populates="notes")
    admin: Mapped[User] = relationship()


class TicketDraft(Base):
    """Cached AI draft reply, one per ticket, so we don't pay for the same draft twice."""

    __tablename__ = "ticket_drafts"
    __table_args__ = SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=UUID_DEFAULT)
    ticket_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app.tickets.id", ondelete="CASCADE"), unique=True)
    draft_text: Mapped[str] = mapped_column(Text)
    model_used: Mapped[Optional[str]] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)


class RequestLog(Base):
    __tablename__ = "request_logs"
    __table_args__ = SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=UUID_DEFAULT)
    request_method: Mapped[str] = mapped_column(String(10))
    request_url: Mapped[str] = mapped_column(Text)
    api_url: Mapped[Optional[str]] = mapped_column(Text)
    status_code: Mapped[Optional[int]] = mapped_column(Integer)
    input: Mapped[Optional[Any]] = mapped_column(JSONB)
    response: Mapped[Optional[Any]] = mapped_column(JSONB)
    error: Mapped[Optional[str]] = mapped_column(Text)
    ip: Mapped[Optional[str]] = mapped_column(Text)
    user_agent: Mapped[Optional[str]] = mapped_column(Text)
    called_by: Mapped[Optional[str]] = mapped_column(ForeignKey("app.users.id"))
    duration_ms: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    start_on: Mapped[datetime] = mapped_column(TZ, server_default=NOW)
    completed_on: Mapped[Optional[datetime]] = mapped_column(TZ)


class LlmLog(Base):
    __tablename__ = "llm_logs"
    __table_args__ = SCHEMA

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=UUID_DEFAULT)
    ticket_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("app.tickets.id", ondelete="SET NULL"))
    operation_type: Mapped[str] = mapped_column(String(50))  # 'classify_priority' | 'draft_response'
    model_name: Mapped[str] = mapped_column(Text)
    system_prompt: Mapped[Optional[str]] = mapped_column(Text)
    user_prompt: Mapped[str] = mapped_column(Text)
    context_data: Mapped[Optional[Any]] = mapped_column(JSONB)
    raw_response: Mapped[Optional[str]] = mapped_column(Text)
    parsed_response: Mapped[Optional[Any]] = mapped_column(JSONB)
    prompt_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    completion_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    total_tokens: Mapped[Optional[int]] = mapped_column(Integer)
    latency_ms: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    status: Mapped[LlmLogStatus] = mapped_column(llm_log_status_enum, server_default=text("'success'"))
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    is_fallback_used: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    called_by: Mapped[Optional[str]] = mapped_column(ForeignKey("app.users.id"))
    created_at: Mapped[datetime] = mapped_column(TZ, server_default=NOW)
