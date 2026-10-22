"""The only place that talks to the AI provider (Google Gemini).

Every call goes through call_llm(), which:
- refuses fast when AI isn't configured (no key / no model) -> caller uses its fallback
- times out after AI_TIMEOUT_SECONDS
- retries ONCE, after 2 s, only for server errors (5xx) and timeouts
- never retries a 429 (quota used up): retrying would just fail again and burn time
- treats an empty / cut-off / blocked answer as a failure
- writes one row to app.llm_logs per call: prompts, tokens, latency, outcome

Callers catch LLMUnavailable and switch to their manual / rule-based path.
The API key is read from backend settings only; nothing here reaches the browser.
"""
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any

import httpx
from google import genai
from google.genai import errors, types

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.rate_limit import AI_CALLS_PER_USER, AI_CALLS_TOTAL
from app.models import LlmLog, LlmLogStatus

logger = logging.getLogger("bookleaf.ai")

RETRY_DELAY_SECONDS = 2.0  # "model overloaded" 503s often clear within a couple of seconds


def _google_reason(e: errors.APIError) -> str:
    """Google's own explanation, e.g. "503 UNAVAILABLE: The model is overloaded." (shortened)."""
    message = " ".join(str(e.message or "").split())
    return f"{e.code} {e.status}: {message[:160]}" if message else f"{e.code} {e.status}"


class LLMUnavailable(Exception):
    """The AI couldn't give a usable answer. `reason` is safe to show to admins."""

    def __init__(self, reason: str, status: LlmLogStatus = LlmLogStatus.FAILED):
        super().__init__(reason)
        self.reason = reason
        self.status = status


@dataclass
class LLMResult:
    text: str
    parsed: Any
    model: str
    prompt_tokens: int | None
    completion_tokens: int | None
    total_tokens: int | None
    latency_ms: float


_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(
            api_key=settings.GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=settings.AI_TIMEOUT_SECONDS * 1000),  # milliseconds
        )
    return _client


def _generate(model: str, contents: str, config: types.GenerateContentConfig):
    """The raw SDK call. Kept separate so tests can replace it with a fake."""
    return _get_client().models.generate_content(model=model, contents=contents, config=config)


def _config(system: str, max_output_tokens: int, response_schema: Any | None) -> types.GenerateContentConfig:
    # No temperature / top_p: Google deprecated sampling parameters on newer Flash models.
    # Consistency comes from the strict JSON schema (classification) and the prompt rules (drafts).
    cfg: dict[str, Any] = {"system_instruction": system, "max_output_tokens": max_output_tokens}
    if response_schema is not None:
        cfg["response_mime_type"] = "application/json"
        cfg["response_schema"] = response_schema
    if settings.GEMINI_THINKING_LEVEL.strip():
        cfg["thinking_config"] = types.ThinkingConfig(thinking_level=settings.GEMINI_THINKING_LEVEL.strip())
    return types.GenerateContentConfig(**cfg)


def _usage(response) -> tuple[int | None, int | None, int | None]:
    u = getattr(response, "usage_metadata", None)
    if u is None:
        return None, None, None
    prompt, total = u.prompt_token_count, u.total_token_count
    completion = (total - prompt) if (total is not None and prompt is not None) else u.candidates_token_count
    return prompt, completion, total


def _check_answer(response) -> str:
    """Return the text, or raise if the model stopped early or returned nothing."""
    candidates = getattr(response, "candidates", None) or []
    finish = getattr(candidates[0], "finish_reason", None) if candidates else None
    finish_name = getattr(finish, "name", str(finish)) if finish is not None else None
    if finish_name == "MAX_TOKENS":
        raise LLMUnavailable(
            "AI ran out of output tokens before finishing (MAX_TOKENS). "
            "Thinking models use part of the limit: set GEMINI_THINKING_LEVEL=low"
        )
    if finish_name and finish_name not in ("STOP", "FINISH_REASON_UNSPECIFIED"):
        raise LLMUnavailable(f"AI answer was blocked ({finish_name})")
    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise LLMUnavailable("AI returned an empty answer")
    return text


def _log(**fields) -> None:
    """Write one llm_logs row in its own session, so logging can never break the caller's transaction."""
    try:
        with SessionLocal() as db, db.begin():
            db.add(LlmLog(**fields))
    except Exception:  # logging must never take the feature down
        logger.exception("Could not write llm_logs row")


def call_llm(
    *,
    operation: str,
    model: str,
    system: str,
    user: str,
    max_output_tokens: int,
    response_schema: Any | None = None,
    ticket_id: uuid.UUID | None = None,
    called_by: str | None = None,
    context: dict | None = None,
) -> LLMResult:
    base_log = dict(
        ticket_id=ticket_id, operation_type=operation, model_name=model or "(not set)",
        system_prompt=system, user_prompt=user, context_data=context, called_by=called_by,
    )

    if not settings.ai_enabled:
        _log(**base_log, status=LlmLogStatus.FALLBACK, is_fallback_used=True,
             error_message="AI not configured (GEMINI_API_KEY / GEMINI_MODEL empty)")
        raise LLMUnavailable("AI is not configured on the server", LlmLogStatus.FALLBACK)

    # Our own limit, checked before calling Google: protects the quota from one busy user or a bug.
    user_key = called_by or "system"
    wait = max(AI_CALLS_PER_USER.retry_after(user_key), AI_CALLS_TOTAL.retry_after("all"))
    if wait:
        reason = f"Too many AI requests right now; try again in {wait} s"
        _log(**base_log, status=LlmLogStatus.RATE_LIMITED, is_fallback_used=True, error_message=reason)
        raise LLMUnavailable(reason, LlmLogStatus.RATE_LIMITED)
    AI_CALLS_PER_USER.record(user_key)
    AI_CALLS_TOTAL.record("all")

    config = _config(system, max_output_tokens, response_schema)
    started = time.perf_counter()
    last_error: LLMUnavailable | None = None
    prompt_t = completion_t = total_t = None

    for attempt in (1, 2):
        try:
            response = _generate(model, user, config)
            prompt_t, completion_t, total_t = _usage(response)  # read first: logged even if the answer is unusable
            text = _check_answer(response)
            latency = round((time.perf_counter() - started) * 1000, 2)
            parsed = getattr(response, "parsed", None) if response_schema is not None else None
            _log(**base_log, status=LlmLogStatus.SUCCESS, raw_response=text,
                 parsed_response=parsed.model_dump(mode="json") if hasattr(parsed, "model_dump") else None,
                 prompt_tokens=prompt_t, completion_tokens=completion_t, total_tokens=total_t, latency_ms=latency)
            return LLMResult(text, parsed, model, prompt_t, completion_t, total_t, latency)

        except errors.ClientError as e:  # 4xx: our request or quota. Retrying won't help.
            if e.code == 429:
                last_error = LLMUnavailable("AI quota used up (rate limited)", LlmLogStatus.RATE_LIMITED)
            else:
                last_error = LLMUnavailable(f"AI request rejected ({_google_reason(e)})")
            break
        except errors.ServerError as e:  # 5xx: provider trouble, worth one retry
            last_error = LLMUnavailable(f"AI service error ({_google_reason(e)})")
        except (httpx.TimeoutException, httpx.TransportError):
            last_error = LLMUnavailable("AI service timed out or unreachable")
        except LLMUnavailable as e:  # empty / cut-off answer: a retry rarely helps, stop
            last_error = e
            break
        except Exception as e:  # anything unexpected from the SDK
            logger.exception("Unexpected AI error")
            last_error = LLMUnavailable(f"Unexpected AI error ({type(e).__name__})")
            break

        if attempt == 1:
            time.sleep(RETRY_DELAY_SECONDS)

    latency = round((time.perf_counter() - started) * 1000, 2)
    _log(**base_log, status=last_error.status, error_message=last_error.reason, latency_ms=latency, is_fallback_used=True,
         prompt_tokens=prompt_t, completion_tokens=completion_t, total_tokens=total_t)
    logger.warning("AI %s failed: %s", operation, last_error.reason)
    raise last_error
