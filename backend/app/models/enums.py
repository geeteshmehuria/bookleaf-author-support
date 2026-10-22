"""Python versions of the Postgres ENUM types in schema.sql.

The string values must match schema.sql exactly. Pydantic schemas and the AI
prompts reuse these, so the allowed values are defined in one place in Python.
"""
import enum

from sqlalchemy.dialects.postgresql import ENUM


class TicketStatus(str, enum.Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    RESOLVED = "Resolved"
    CLOSED = "Closed"


class TicketPriority(str, enum.Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MEDIUM = "Medium"
    LOW = "Low"


class TicketCategory(str, enum.Enum):
    ROYALTY = "Royalty & Payments"
    ISBN_METADATA = "ISBN & Metadata Issues"
    PRINTING_QUALITY = "Printing & Quality"
    DISTRIBUTION = "Distribution & Availability"
    BOOK_STATUS = "Book Status & Production Updates"
    GENERAL = "General Inquiry"


class LlmLogStatus(str, enum.Enum):
    SUCCESS = "success"
    RATE_LIMITED = "rate_limited"
    FALLBACK = "fallback"
    FAILED = "failed"


def pg_enum(py_enum: type[enum.Enum], name: str) -> ENUM:
    """Map a Python enum to an existing Postgres enum type.

    values_callable: store the enum's value ("In Progress"), not its name ("IN_PROGRESS").
    create_type=False: the type is created by schema.sql, never by SQLAlchemy.
    """
    return ENUM(
        py_enum,
        name=name,
        schema="app",
        create_type=False,
        values_callable=lambda e: [m.value for m in e],
    )


ticket_status_enum = pg_enum(TicketStatus, "ticket_status")
ticket_priority_enum = pg_enum(TicketPriority, "ticket_priority")
ticket_category_enum = pg_enum(TicketCategory, "ticket_category")
llm_log_status_enum = pg_enum(LlmLogStatus, "llm_log_status")
