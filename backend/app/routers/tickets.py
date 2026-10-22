"""Author's own support tickets.

Every route depends on require_author, and every query filters by the author
from the token. Internal notes are never loaded here.
"""
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_author
from app.models import User
from app.schemas.common import error_responses
from app.schemas.tickets import AuthorTicketDetail, AuthorTicketSummary, ReplyCreate, TicketCreate
from app.services import tickets as svc
from app.services.ai_classifier import classify_ticket_task

router = APIRouter(
    prefix="/tickets",
    tags=["Tickets (author)"],
    dependencies=[Depends(require_author)],
    responses=error_responses(401, 403),
)


@router.post("", response_model=AuthorTicketDetail, status_code=201, responses=error_responses(422))
def create_ticket(
    body: TicketCreate,
    background: BackgroundTasks,
    author: User = Depends(require_author),
    db: Session = Depends(get_db),
) -> AuthorTicketDetail:
    """Raise a support query. `book_id: null` = General / Account Level.

    The ticket is saved and returned first; AI classification runs afterwards in the
    background, so a slow or failing AI never delays or blocks the author."""
    ticket = svc.create_ticket(db, author, body)
    background.add_task(classify_ticket_task, ticket.id, author.id)
    return svc.to_author_detail(ticket)


@router.get("", response_model=list[AuthorTicketSummary])
def list_my_tickets(author: User = Depends(require_author), db: Session = Depends(get_db)) -> list[AuthorTicketSummary]:
    """All of the author's tickets, most recently updated first."""
    return [svc.to_author_summary(t) for t in svc.list_author_tickets(db, author)]


@router.get("/{ticket_id}", response_model=AuthorTicketDetail, responses=error_responses(404))
def get_my_ticket(
    ticket_id: str, author: User = Depends(require_author), db: Session = Depends(get_db)
) -> AuthorTicketDetail:
    """One ticket with its full thread. Another author's ticket returns 404."""
    return svc.to_author_detail(svc.get_author_ticket(db, author, svc.parse_ticket_id(ticket_id)))


@router.post(
    "/{ticket_id}/replies", response_model=AuthorTicketDetail, status_code=201, responses=error_responses(404, 409, 422)
)
def reply_to_my_ticket(
    ticket_id: str, body: ReplyCreate, author: User = Depends(require_author), db: Session = Depends(get_db)
) -> AuthorTicketDetail:
    """Add a message to your own ticket. Reopens a Resolved ticket; Closed tickets return 409."""
    ticket = svc.get_author_ticket(db, author, svc.parse_ticket_id(ticket_id))
    return svc.to_author_detail(svc.add_author_reply(db, author, ticket, body.body))
