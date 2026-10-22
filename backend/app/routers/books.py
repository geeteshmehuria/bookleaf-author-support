"""Author's own books.

Every query filters by the logged-in author's ID from the token (require_author).
There is no author_id parameter anywhere, so an author cannot ask for someone
else's books, even by editing the URL.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select

from app.core.database import DbSession
from app.core.deps import require_author
from app.core.errors import APIError
from app.models import Book, User
from app.schemas.books import BookOut
from app.schemas.common import error_responses

router = APIRouter(prefix="/books", tags=["Books"], responses=error_responses(401, 403))


@router.get("", response_model=list[BookOut])
def list_my_books(db: DbSession, author: User = Depends(require_author)) -> list[Book]:
    """All books of the logged-in author. Newest first; books still in production come first."""
    return list(
        db.scalars(
            select(Book)
            .where(Book.author_id == author.id)
            .order_by(Book.publication_date.desc().nulls_first(), Book.id)
        )
    )


@router.get("/{book_id}", response_model=BookOut, responses=error_responses(404))
def get_my_book(book_id: str, db: DbSession, author: User = Depends(require_author)) -> Book:
    """One book. Another author's book gives 404, not 403, so the response
    doesn't reveal that the ID exists."""
    book = db.scalar(select(Book).where(Book.id == book_id, Book.author_id == author.id))
    if book is None:
        raise APIError(404, "BOOK_NOT_FOUND", "Book not found")
    return book
