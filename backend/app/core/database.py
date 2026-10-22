from typing import Annotated

from fastapi import Depends
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


def _normalize_db_url(url: str) -> str:
    """Always use the psycopg2 driver (the one in requirements.txt).

    - SQLAlchemy 2.1+ reads a plain 'postgresql://' URL as psycopg v3, which isn't installed.
    - Render and Heroku give 'postgres://', which SQLAlchemy doesn't accept at all.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg2://" + url[len(prefix):]
    return url


# pool_pre_ping: test a pooled connection before using it, so a DB restart
# (or Render's free Postgres dropping idle connections) doesn't cause errors.
engine = create_engine(_normalize_db_url(settings.DATABASE_URL), pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    """Parent class for all models. Tables live in the 'app' schema (see schema.sql)."""


def get_db():
    """One session and ONE transaction per request (unit of work).

    The route and the services it calls only read, add and flush; they never commit.
    If the route finishes, everything is committed together. If anything fails, it is all
    rolled back, so a request can't leave half its changes in the database.
    """
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except BaseException:
        db.rollback()
        raise
    finally:
        db.close()


# scope="function": the commit above runs BEFORE the response is sent. With FastAPI's default
# it runs after, and a failed commit would still have told the client "201 Created".
DbSession = Annotated[Session, Depends(get_db, scope="function")]
