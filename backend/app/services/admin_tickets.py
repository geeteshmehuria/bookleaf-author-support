"""Admin-side ticket logic: the queue, ticket detail, overrides, notes and replies."""
import uuid
from datetime import datetime, time, timedelta, timezone

from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import APIError
from app.models import (
    InternalNote,
    Role,
    Ticket,
    TicketPriority,
    TicketResponse,
    TicketStatus,
    User,
)
from app.schemas.admin import (
    OVERDUE_AFTER_HOURS,
    AdminMessageOut,
    AdminTicketDetail,
    AdminTicketRow,
    AuthorProfileOut,
    NoteOut,
    PersonOut,
    QueueFilters,
    TicketUpdate,
)
from app.schemas.books import BookOut
from app.schemas.tickets import TicketBookOut
from app.services.ai_classifier import classified_by
from app.services.tickets import now

UNRESOLVED = (TicketStatus.OPEN, TicketStatus.IN_PROGRESS)

# Lower number = more urgent. Used for the default "urgency" sort.
PRIORITY_RANK = case(
    {TicketPriority.CRITICAL: 0, TicketPriority.HIGH: 1, TicketPriority.MEDIUM: 2, TicketPriority.LOW: 3},
    value=Ticket.priority,
)
STATUS_RANK = case({TicketStatus.OPEN: 0, TicketStatus.IN_PROGRESS: 0}, value=Ticket.status, else_=1)


def _is_admin(user: User) -> bool:
    return user.role_name == "admin"


# --- Queue -----------------------------------------------------------------

def _apply_filters(stmt, f: QueueFilters, me: User):
    if f.status:
        stmt = stmt.where(Ticket.status.in_(f.status))
    if f.category:
        stmt = stmt.where(Ticket.category.in_(f.category))
    if f.priority:
        stmt = stmt.where(Ticket.priority.in_(f.priority))
    if f.assigned == "me":
        stmt = stmt.where(Ticket.assigned_to == me.id)
    elif f.assigned == "unassigned":
        stmt = stmt.where(Ticket.assigned_to.is_(None))
    elif f.assigned != "any":
        stmt = stmt.where(Ticket.assigned_to == f.assigned)
    # Dates are whole days in UTC; created_to is inclusive.
    if f.created_from:
        stmt = stmt.where(Ticket.created_at >= datetime.combine(f.created_from, time.min, timezone.utc))
    if f.created_to:
        stmt = stmt.where(Ticket.created_at < datetime.combine(f.created_to + timedelta(days=1), time.min, timezone.utc))
    if f.q and f.q.strip():
        term = f"%{f.q.strip()}%"
        number = f.q.strip().lstrip("#")
        conditions = [Ticket.subject.ilike(term), User.name.ilike(term), User.email.ilike(term)]
        # isascii: "²".isdigit() is True but int("²") fails; the bound keeps it inside Postgres INT
        if number.isascii() and number.isdigit() and int(number) <= 2_147_483_647:
            conditions.append(Ticket.ticket_number == int(number))
        stmt = stmt.where(or_(*conditions))
    return stmt


ORDERING = {
    # Unresolved first, then Critical -> Low, then oldest first: the most urgent
    # and longest-waiting tickets are at the top (the brief's "easy to spot").
    "urgency": (STATUS_RANK, PRIORITY_RANK, Ticket.created_at.asc()),
    "oldest": (Ticket.created_at.asc(),),
    "newest": (Ticket.created_at.desc(),),
    "updated": (Ticket.updated_at.desc(),),
}


def list_queue(db: Session, f: QueueFilters, me: User) -> tuple[list[Ticket], int]:
    base = select(Ticket).join(User, User.id == Ticket.author_id)
    base = _apply_filters(base, f, me)
    total = db.scalar(select(func.count()).select_from(base.subquery()))
    rows = db.scalars(
        base.options(
            selectinload(Ticket.author),
            selectinload(Ticket.book),
            selectinload(Ticket.assignee),
            selectinload(Ticket.responses).selectinload(TicketResponse.sender).selectinload(User.role),
        )
        .order_by(*ORDERING[f.sort], Ticket.ticket_number)
        .limit(f.limit)
        .offset(f.offset)
    ).all()
    return list(rows), total or 0


# --- Single ticket ---------------------------------------------------------

def get_ticket(db: Session, ticket_id: uuid.UUID) -> Ticket:
    ticket = db.scalar(
        select(Ticket)
        .where(Ticket.id == ticket_id)
        .options(
            selectinload(Ticket.author).selectinload(User.books),
            selectinload(Ticket.book),
            selectinload(Ticket.assignee),
            selectinload(Ticket.responses).selectinload(TicketResponse.sender).selectinload(User.role),
            selectinload(Ticket.notes).selectinload(InternalNote.admin),
        )
    )
    if ticket is None:
        raise APIError(404, "TICKET_NOT_FOUND", "Ticket not found")
    return ticket


def update_ticket(db: Session, ticket: Ticket, data: TicketUpdate) -> Ticket:
    changes = data.model_dump(exclude_unset=True)  # only fields the admin actually sent
    if not changes:
        raise APIError(422, "NOTHING_TO_UPDATE", "Send at least one of: status, category, priority, assigned_to")

    for field in ("status", "category", "priority"):
        if changes.get(field) is not None:
            setattr(ticket, field, changes[field])
        elif field in changes:
            raise APIError(422, "VALIDATION_ERROR", f"{field} can't be empty")

    if "assigned_to" in changes:
        assignee_id = changes["assigned_to"]
        if assignee_id is not None:
            assignee = db.get(User, assignee_id)
            if assignee is None or not _is_admin(assignee):
                raise APIError(422, "INVALID_ASSIGNEE", "Tickets can only be assigned to a BookLeaf admin")
        ticket.assigned_to = assignee_id

    ticket.updated_at = now()
    db.commit()
    db.expire_all()
    return get_ticket(db, ticket.id)


def add_note(db: Session, ticket: Ticket, admin: User, body: str) -> Ticket:
    db.add(InternalNote(ticket_id=ticket.id, admin_id=admin.id, body=body))
    # Notes don't bump updated_at: the author's "Updated" time shouldn't move for a change they can't see.
    db.commit()
    db.expire_all()
    return get_ticket(db, ticket.id)


def add_reply(db: Session, ticket: Ticket, admin: User, body: str, is_ai_drafted: bool) -> Ticket:
    """Send a reply to the author. A first reply moves Open -> In Progress;
    the admin sets Resolved / Closed explicitly."""
    db.add(TicketResponse(ticket_id=ticket.id, sender_id=admin.id, body=body, is_ai_drafted=is_ai_drafted))
    if ticket.status == TicketStatus.OPEN:
        ticket.status = TicketStatus.IN_PROGRESS
    if ticket.assigned_to is None:
        ticket.assigned_to = admin.id  # whoever answers owns it, unless someone already does
    ticket.updated_at = now()
    db.commit()
    db.expire_all()
    return get_ticket(db, ticket.id)


def list_team(db: Session) -> list[User]:
    return list(db.scalars(select(User).join(Role).where(Role.name == "admin").order_by(User.name)))


# --- Shaping ---------------------------------------------------------------

def _waiting(t: Ticket, at: datetime) -> tuple[str, float]:
    """Who acts next, and for how many hours the author has been waiting."""
    last = t.responses[-1] if t.responses else None
    if last is not None and _is_admin(last.sender):
        return "author", 0.0
    since = last.created_at if last is not None else t.created_at
    return "support", round((at - since).total_seconds() / 3600, 1)


def to_row(t: Ticket, at: datetime | None = None) -> AdminTicketRow:
    at = at or now()
    waiting_on, hours = _waiting(t, at)
    return AdminTicketRow(
        id=t.id,
        ticket_number=t.ticket_number,
        subject=t.subject,
        status=t.status,
        category=t.category,
        priority=t.priority,
        ai_category=t.ai_category,
        ai_priority=t.ai_priority,
        classified_by=classified_by(t),
        author=PersonOut.model_validate(t.author),
        book=TicketBookOut.model_validate(t.book) if t.book else None,
        assignee=PersonOut.model_validate(t.assignee) if t.assignee else None,
        created_at=t.created_at,
        updated_at=t.updated_at,
        reply_count=len(t.responses),
        waiting_on=waiting_on,
        waiting_hours=hours,
        overdue=t.status in UNRESOLVED and waiting_on == "support" and hours > OVERDUE_AFTER_HOURS,
    )


def to_detail(t: Ticket) -> AdminTicketDetail:
    return AdminTicketDetail(
        **to_row(t).model_dump(),
        description=t.description,
        ai_reasoning=t.ai_reasoning,
        author_profile=AuthorProfileOut(
            id=t.author.id,
            name=t.author.name,
            email=t.author.email,
            phone=t.author.phone,
            city=t.author.city,
            joined_date=t.author.joined_date,
            book_count=len(t.author.books),
        ),
        book_detail=BookOut.model_validate(t.book) if t.book else None,
        messages=[
            AdminMessageOut(
                id=r.id,
                body=r.body,
                created_at=r.created_at,
                from_support=_is_admin(r.sender),
                sender=PersonOut.model_validate(r.sender),
                is_ai_drafted=r.is_ai_drafted,
            )
            for r in t.responses
        ],
        notes=[NoteOut(id=n.id, body=n.body, created_at=n.created_at, admin=PersonOut.model_validate(n.admin)) for n in t.notes],
    )
