from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class BookOut(BaseModel):
    """One book, as its author sees it.

    Money fields are plain numbers in rupees (float), not strings: the DB stores
    NUMERIC(…, 2), and Pydantic would otherwise send Decimal as "399.00".
    Nullable fields are null for books still in production (MRP, publication date,
    royalty per copy, print partner) or never paid out (last_royalty_payout_date).
    """

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(examples=["BK001"])
    title: str
    isbn: str | None
    genre: str | None
    publication_date: date | None
    status: str = Field(examples=["Published & Live", "In Production - Cover Design"])
    mrp: float | None
    author_royalty_per_copy: float | None
    total_copies_sold: int
    total_royalty_earned: float
    royalty_paid: float
    royalty_pending: float
    last_royalty_payout_date: date | None
    print_partner: str | None
    available_on: list[str]

    @computed_field
    @property
    def stage(self) -> Literal["published", "in_production"]:
        """Saves the frontend from parsing the status text."""
        return "in_production" if self.status.lower().startswith("in production") else "published"
