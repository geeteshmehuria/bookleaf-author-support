"""Admin-only routes. The router-level require_admin guards every route here,
so a new admin route can't be added without the check by mistake."""
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models import Ticket, TicketCategory, TicketPriority, TicketStatus, User
from app.schemas.admin import (
    AdminReplyCreate,
    AdminTicketDetail,
    NoteCreate,
    PersonOut,
    QueueFilters,
    TicketPage,
    TicketUpdate,
)
from app.schemas.common import error_responses
from app.services import admin_tickets as svc
from app.services.tickets import parse_ticket_id

router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
    responses=error_responses(401, 403),
)


# --- Queue -----------------------------------------------------------------

@router.get("/tickets", response_model=TicketPage)
def ticket_queue(
    status: list[TicketStatus] | None = Query(None, description="Repeat to pick several: ?status=Open&status=In Progress"),
    category: list[TicketCategory] | None = Query(None),
    priority: list[TicketPriority] | None = Query(None),
    assigned: str = Query("any", description='"any", "me", "unassigned", or an admin user ID'),
    created_from: date | None = Query(None, description="YYYY-MM-DD, inclusive (UTC)"),
    created_to: date | None = Query(None, description="YYYY-MM-DD, inclusive (UTC)"),
    q: str | None = Query(None, max_length=100, description="Search subject, author name or email, or #ticket number"),
    sort: Literal["urgency", "oldest", "newest", "updated"] = Query(
        "urgency", description="urgency = unresolved first, then Critical to Low, then oldest first"
    ),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> TicketPage:
    """All tickets from all authors, filterable and sorted by urgency by default."""
    f = QueueFilters(
        status=status, category=category, priority=priority, assigned=assigned, created_from=created_from,
        created_to=created_to, q=q, sort=sort, limit=limit, offset=offset,
    )
    tickets, total = svc.list_queue(db, f, admin)
    now = svc.now()
    return TicketPage(items=[svc.to_row(t, now) for t in tickets], total=total, limit=limit, offset=offset)


@router.get("/tickets/{ticket_id}", response_model=AdminTicketDetail, responses=error_responses(404))
def ticket_detail(ticket_id: str, db: Session = Depends(get_db)) -> AdminTicketDetail:
    """Full ticket: thread, internal notes, author profile and the book's data."""
    return svc.to_detail(svc.get_ticket(db, parse_ticket_id(ticket_id)))


@router.patch("/tickets/{ticket_id}", response_model=AdminTicketDetail, responses=error_responses(404, 422))
def update_ticket(ticket_id: str, body: TicketUpdate, db: Session = Depends(get_db)) -> AdminTicketDetail:
    """Change status, override category / priority, or (un)assign. Send only what changes.
    The AI's original suggestion stays in ai_category / ai_priority for comparison."""
    ticket = svc.get_ticket(db, parse_ticket_id(ticket_id))
    return svc.to_detail(svc.update_ticket(db, ticket, body))


@router.post("/tickets/{ticket_id}/notes", response_model=AdminTicketDetail, status_code=201, responses=error_responses(404, 422))
def add_note(
    ticket_id: str, body: NoteCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> AdminTicketDetail:
    """Internal note. Visible to admins only, never to the author."""
    ticket = svc.get_ticket(db, parse_ticket_id(ticket_id))
    return svc.to_detail(svc.add_note(db, ticket, admin, body.body))


@router.post("/tickets/{ticket_id}/replies", response_model=AdminTicketDetail, status_code=201, responses=error_responses(404, 422))
def reply(
    ticket_id: str, body: AdminReplyCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)
) -> AdminTicketDetail:
    """Reply to the author (appears in their thread). Moves Open -> In Progress and
    assigns the ticket to the sender if nobody owns it yet."""
    ticket = svc.get_ticket(db, parse_ticket_id(ticket_id))
    return svc.to_detail(svc.add_reply(db, ticket, admin, body.body, body.is_ai_drafted))


@router.get("/team", response_model=list[PersonOut])
def team(db: Session = Depends(get_db)) -> list[User]:
    """Admins a ticket can be assigned to."""
    return svc.list_team(db)


# --- Dashboard summary -----------------------------------------------------

class QueueSummary(BaseModel):
    by_status: dict[str, int]
    unresolved_by_priority: dict[str, int]
    unassigned_unresolved: int
    assigned_to_me: int


@router.get("/summary", response_model=QueueSummary)
def queue_summary(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> QueueSummary:
    """Ticket counts for the admin dashboard."""
    unresolved = Ticket.status.in_(svc.UNRESOLVED)
    by_status = dict(db.execute(select(Ticket.status, func.count()).group_by(Ticket.status)).all())
    by_priority = dict(db.execute(select(Ticket.priority, func.count()).where(unresolved).group_by(Ticket.priority)).all())
    count = lambda *where: db.scalar(select(func.count()).select_from(Ticket).where(*where)) or 0  # noqa: E731
    return QueueSummary(
        # Every status / priority listed, with 0 where there are none, so the UI never has a missing key.
        by_status={s.value: by_status.get(s, 0) for s in TicketStatus},
        unresolved_by_priority={p.value: by_priority.get(p, 0) for p in TicketPriority},
        unassigned_unresolved=count(unresolved, Ticket.assigned_to.is_(None)),
        assigned_to_me=count(unresolved, Ticket.assigned_to == admin.id),
    )
