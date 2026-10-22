"""Check the Gemini setup from this machine.

Run from inside backend/:
    python -m app.check_ai

Prints which models your key can use and makes one tiny test call to each
configured model, with Google's full error if it fails. Never prints the key.
"""
import time

from google import genai
from google.genai import errors, types

from app.core.config import settings


def main() -> None:
    key = settings.GEMINI_API_KEY.strip()
    print(f"Key: {'set, ' + str(len(key)) + ' characters' if key else 'NOT SET (AI is off)'}")
    print(f"GEMINI_MODEL          = {settings.GEMINI_MODEL!r}")
    print(f"GEMINI_CLASSIFY_MODEL = {settings.GEMINI_CLASSIFY_MODEL!r} (used: {settings.classify_model!r})")
    if not key:
        return

    client = genai.Client(api_key=key, http_options=types.HttpOptions(timeout=30_000))

    print("\nModels your key can use (names containing 'flash'):")
    try:
        models = sorted(
            m.name.removeprefix("models/")
            for m in client.models.list()
            if "flash" in m.name and "generateContent" in (m.supported_actions or [])
        )
        print("  " + "\n  ".join(models) if models else "  (none)")
    except errors.APIError as e:
        print(f"  Could not list models: {e.code} {e.status}: {e.message}")

    for name in dict.fromkeys([settings.GEMINI_MODEL, settings.classify_model]):
        if not name:
            continue
        print(f"\nTest call to {name!r} ... ", end="", flush=True)
        started = time.perf_counter()
        try:
            r = client.models.generate_content(
                model=name, contents="Reply with the single word OK.",
                config=types.GenerateContentConfig(max_output_tokens=200),
            )
            finish = r.candidates[0].finish_reason if r.candidates else None
            print(f"OK in {time.perf_counter() - started:.1f}s: {r.text!r} (finish: {finish})")
        except errors.APIError as e:
            print(f"FAILED in {time.perf_counter() - started:.1f}s\n  {e.code} {e.status}: {e.message}")


if __name__ == "__main__":
    main()
