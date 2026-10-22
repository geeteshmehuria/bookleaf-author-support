"""Admin-only routes. Every route here depends on require_admin.

Phase 2 adds only the queue summary (counts for the dashboard's stat cards).
The ticket queue, overrides, notes and replies come in Phase 5.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.models import Ticket, TicketPriority, TicketStatus, User
from app.schemas.common import error_responses

# The dependency on the router itself guards every route in this file,
# so a new admin route can't be added without the check by mistake.
router = APIRouter(
    prefix="/admin",
    tags=["Admin"],
    dependencies=[Depends(require_admin)],
    responses=error_responses(401, 403),
)

UNRESOLVED = (TicketStatus.OPEN, TicketStatus.IN_PROGRESS)


class QueueSummary(BaseModel):
    by_status: dict[str, int]
    unresolved_by_priority: dict[str, int]
    unassigned_unresolved: int
    assigned_to_me: int


@router.get("/summary", response_model=QueueSummary)
def queue_summary(admin: User = Depends(require_admin), db: Session = Depends(get_db)) -> QueueSummary:
    """Ticket counts for the admin dashboard."""
    by_status = dict(db.execute(select(Ticket.status, func.count()).group_by(Ticket.status)).all())
    by_priority = dict(
        db.execute(
            select(Ticket.priority, func.count()).where(Ticket.status.in_(UNRESOLVED)).group_by(Ticket.priority)
        ).all()
    )
    unassigned = db.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.status.in_(UNRESOLVED), Ticket.assigned_to.is_(None))
    )
    mine = db.scalar(
        select(func.count()).select_from(Ticket).where(Ticket.status.in_(UNRESOLVED), Ticket.assigned_to == admin.id)
    )
    return QueueSummary(
        # Every status/priority listed, with 0 where there are none, so the UI never has a missing key.
        by_status={s.value: by_status.get(s, 0) for s in TicketStatus},
        unresolved_by_priority={p.value: by_priority.get(p, 0) for p in TicketPriority},
        unassigned_unresolved=unassigned or 0,
        assigned_to_me=mine or 0,
    )
