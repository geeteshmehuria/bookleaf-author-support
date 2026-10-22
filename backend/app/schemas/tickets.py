"""Ticket shapes for the AUTHOR side.

What authors never get (by design, not by filtering later): internal notes,
priority, AI fields, who it is assigned to, and whether a reply was AI-drafted.
Admin schemas (Phase 5) live separately so a field can't leak by reuse.
"""
import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.models import TicketStatus

SUBJECT_MIN, SUBJECT_MAX = 5, 150
DESCRIPTION_MIN, DESCRIPTION_MAX = 20, 5000
REPLY_MIN, REPLY_MAX = 1, 5000

Subject = Annotated[str, StringConstraints(strip_whitespace=True, min_length=SUBJECT_MIN, max_length=SUBJECT_MAX)]
Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=DESCRIPTION_MIN, max_length=DESCRIPTION_MAX)]
ReplyBody = Annotated[str, StringConstraints(strip_whitespace=True, min_length=REPLY_MIN, max_length=REPLY_MAX)]


class TicketCreate(BaseModel):
    book_id: str | None = Field(
        default=None,
        description='One of your book IDs, or null for "General / Account Level"',
        examples=["BK011"],
    )
    subject: Subject = Field(examples=["Royalty for October not received"])
    description: Description = Field(examples=["My dashboard shows royalty pending since July but nothing has been paid."])

    @field_validator("book_id", mode="before")
    @classmethod
    def blank_means_general(cls, v):
        # The form's "General / Account Level" option may arrive as "" — treat it as no book.
        if isinstance(v, str) and not v.strip():
            return None
        return v.strip() if isinstance(v, str) else v


class ReplyCreate(BaseModel):
    body: ReplyBody


class TicketBookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str


class ThreadMessageOut(BaseModel):
    """One message in the ticket thread."""

    id: uuid.UUID
    body: str
    created_at: datetime
    from_support: bool = Field(description="True if written by the BookLeaf team, false if by the author")
    sender_name: str


class AuthorTicketSummary(BaseModel):
    """A row on the My Tickets page."""

    id: uuid.UUID
    ticket_number: int
    subject: str
    status: TicketStatus
    book: TicketBookOut | None = Field(description="null = General / Account Level")
    created_at: datetime
    updated_at: datetime
    reply_count: int = Field(description="Messages in the thread (from the team or the author)")
    last_reply_from_support: bool = Field(description="True if the newest message is from the team, i.e. waiting on the author")


class AuthorTicketDetail(AuthorTicketSummary):
    description: str
    messages: list[ThreadMessageOut]
    can_reply: bool = Field(description="False once the ticket is Closed")
