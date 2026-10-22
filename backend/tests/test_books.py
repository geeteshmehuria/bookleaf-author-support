"""Phase 3 checks: authors see only their own books, edge cases come through correctly."""
import pytest

from tests.test_auth import API, assert_error, bearer, client, login

PW = "Author@123"


@pytest.fixture(scope="module")
def tokens():
    return {
        "sneha": login({"email": "sneha.kulkarni@email.com", "password": PW}),
        "ananya": login({"email": "ananya.reddy@email.com", "password": PW}),
        "priya": login({"email": "priya.sharma@email.com", "password": PW}),
        "admin": login({"email": "neha.admin@bookleaf.example.com", "password": "Admin@123"}),
    }


def books_of(token):
    r = client.get(f"{API}/books", headers=bearer(token))
    assert r.status_code == 200, r.text
    return r.json()


def test_sneha_sees_her_three_books_in_production_first(tokens):
    books = books_of(tokens["sneha"])
    assert [b["id"] for b in books] == ["BK013", "BK012", "BK011"]


def test_in_production_book_has_nulls_not_zeros(tokens):
    bk013 = books_of(tokens["sneha"])[0]
    assert bk013["stage"] == "in_production"
    assert bk013["status"] == "In Production - Cover Design"
    for field in ("mrp", "publication_date", "author_royalty_per_copy", "last_royalty_payout_date", "print_partner"):
        assert bk013[field] is None, field
    assert bk013["available_on"] == []


def test_money_is_sent_as_numbers(tokens):
    bk011 = next(b for b in books_of(tokens["sneha"]) if b["id"] == "BK011")
    assert bk011["mrp"] == 299 and isinstance(bk011["mrp"], (int, float))
    assert bk011["royalty_paid"] + bk011["royalty_pending"] == bk011["total_royalty_earned"] == 39175
    assert bk011["stage"] == "published"


def test_ananya_never_paid(tokens):
    [bk005] = books_of(tokens["ananya"])
    assert bk005["id"] == "BK005"
    assert bk005["royalty_paid"] == 0
    assert bk005["royalty_pending"] == 2546
    assert bk005["last_royalty_payout_date"] is None


def test_author_can_open_own_book(tokens):
    r = client.get(f"{API}/books/BK001", headers=bearer(tokens["priya"]))
    assert r.status_code == 200
    assert r.json()["title"] == "Whispers of the Ganges"


def test_author_cannot_open_another_authors_book(tokens):
    # BK003 belongs to Rohit. Same 404 as a book that doesn't exist at all.
    other = client.get(f"{API}/books/BK003", headers=bearer(tokens["priya"]))
    missing = client.get(f"{API}/books/BK999", headers=bearer(tokens["priya"]))
    assert_error(other, 404, "BOOK_NOT_FOUND")
    assert other.json() == missing.json()


def test_list_never_contains_other_authors_books(tokens):
    assert {b["id"] for b in books_of(tokens["priya"])} == {"BK001", "BK002"}


def test_admin_gets_403_on_author_books(tokens):
    assert_error(client.get(f"{API}/books", headers=bearer(tokens["admin"])), 403, "FORBIDDEN")


def test_no_token_is_401():
    assert_error(client.get(f"{API}/books"), 401, "NOT_AUTHENTICATED")
