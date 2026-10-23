"""Small in-memory rate limiter (sliding window).

    limiter = RateLimiter(limit=5, window_seconds=900)
    limiter.hit("login:1.2.3.4:priya@email.com")   # raises 429 once over the limit

Why in memory: the app runs as one server process (Render free tier), so a dict is enough
and needs no extra service. With several servers, the counts would live in Redis instead,
so every server sees the same numbers.
"""
import math
import time
from collections import deque
from threading import Lock

from fastapi import Request

from app.core.errors import APIError

MAX_KEYS = 10_000  # stop memory growing without bound if someone sprays many keys


class RateLimiter:
    def __init__(self, limit: int, window_seconds: int, message: str = "Too many requests"):
        self.limit = limit
        self.window = window_seconds
        self.message = message
        self._hits: dict[str, deque[float]] = {}
        self._lock = Lock()  # sync routes run in a thread pool, so guard the dict

    def _recent(self, key: str, now: float) -> deque[float]:
        hits = self._hits.setdefault(key, deque())
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        return hits

    def retry_after(self, key: str) -> int:
        """Seconds until `key` may try again (0 = allowed now)."""
        now = time.monotonic()
        with self._lock:
            hits = self._recent(key, now)
            if len(hits) < self.limit:
                return 0
            return max(1, math.ceil(hits[0] + self.window - now))

    def record(self, key: str) -> None:
        now = time.monotonic()
        with self._lock:
            if len(self._hits) >= MAX_KEYS:
                # drop keys with no recent hits; if still full, start over (fail open, never crash)
                for k in [k for k, v in self._hits.items() if not v or v[-1] <= now - self.window]:
                    del self._hits[k]
                if len(self._hits) >= MAX_KEYS:
                    self._hits.clear()
            self._recent(key, now).append(now)

    def check(self, key: str) -> None:
        """Raise 429 if `key` is over the limit (does not count this call)."""
        wait = self.retry_after(key)
        if wait:
            raise APIError(
                429, "RATE_LIMITED", f"{self.message}. Try again in {_human(wait)}.",
                headers={"Retry-After": str(wait)},
            )

    def hit(self, key: str) -> None:
        """Check, then count this call."""
        self.check(key)
        self.record(key)

    def reset(self, key: str | None = None) -> None:
        with self._lock:
            if key is None:
                self._hits.clear()
            else:
                self._hits.pop(key, None)


def _human(seconds: int) -> str:
    return f"{seconds} seconds" if seconds < 90 else f"{math.ceil(seconds / 60)} minutes"


def client_ip(request: Request) -> str:
    """The caller's IP. Behind Render's proxy this is only correct when uvicorn runs with
    --proxy-headers --forwarded-allow-ips='*' (it then reads X-Forwarded-For); see docs/OPERATIONS.md > Security."""
    return request.client.host if request.client else "unknown"


# --- The app's limits (one place, easy to review) ----------------------------

# Login: count FAILED attempts only, so normal use never trips it.
#  - per email + IP: stops guessing one account's password
#  - per email (any IP): the IP can be faked with an X-Forwarded-For header behind a proxy,
#    so one account also has a cap no matter where the guesses come from
#  - per IP: stops one machine trying many different accounts
LOGIN_FAILS_PER_ACCOUNT = RateLimiter(5, 15 * 60, "Too many failed login attempts")
LOGIN_FAILS_PER_EMAIL = RateLimiter(10, 15 * 60, "Too many failed login attempts for this account")
LOGIN_FAILS_PER_IP = RateLimiter(20, 15 * 60, "Too many failed login attempts from this network")

# New tickets: each one triggers an AI classification call.
TICKETS_PER_AUTHOR = RateLimiter(5, 10 * 60, "You've raised several queries in a short time")

# AI calls (protects the Gemini quota and bill). Over the limit, the call is skipped and the
# app falls back exactly as if the AI were down: keyword rules / manual reply.
AI_CALLS_PER_USER = RateLimiter(10, 60, "Too many AI requests")
AI_CALLS_TOTAL = RateLimiter(30, 60, "The AI is busy")

ALL_LIMITERS = [LOGIN_FAILS_PER_ACCOUNT, LOGIN_FAILS_PER_EMAIL, LOGIN_FAILS_PER_IP, TICKETS_PER_AUTHOR, AI_CALLS_PER_USER, AI_CALLS_TOTAL]
