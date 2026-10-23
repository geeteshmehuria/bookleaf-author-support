# Write-up: BookLeaf Author Support Portal

## What I prioritised

1. **The core ticket loop first.** Author raises a query → it is saved at once → admin sees it in a queue sorted by urgency → admin replies → the author sees the reply within 5 seconds. Everything else was built around this loop.
2. **AI that helps but never blocks.** Classification runs after the ticket is saved, and every AI step has a fallback (keyword rules for triage, a manual reply box for drafts). The app works fully with no API key at all.
3. **Facts from the database, wording from the model.** Payout due dates, the ₹1,000 rollover rule, "likely overdue" and the current production stage are computed in code and handed to the model as facts. The model is told to quote them, not calculate them. This is what keeps drafts specific ("₹2,546 pending, no payout yet") instead of generic.
4. **Access control that can't be bypassed by editing a URL.** Author data is always filtered by the logged-in user from the token, never by an ID in the request. The role is re-read from the database on every call.

## Trade-offs I made

| Choice | Gave up | Why it was worth it |
|---|---|---|
| Polling (5 s / 10 s) instead of WebSockets | Instant push | Simple, works on free hosting, pauses when the tab is hidden |
| Only the matching knowledge-base section + one book + last 3 messages per prompt | The model seeing everything | ~550 tokens per classification, ~1,100 per draft; cached drafts cost nothing on reopen |
| Gemini Flash / Flash-Lite | Some reply polish vs. bigger models | Free tier, fast, strict JSON output; two models so triage uses the cheapest one |
| Sample royalties shown as stored | The 80/20 net-profit formula | The dataset uses a flat amount per copy; recalculating would contradict the numbers we were told to test with |
| Attachments are UI only | Real uploads | The brief marks upload as a bonus; time went to the AI and ticket flow |
| In-memory rate limits | Limits shared across servers | Fine for one server; Redis is the next step |

## How I'd take this to production

- **Reliability:** move AI calls to a job queue (e.g. Celery/RQ) with retries, so a restart never loses a classification. WebSockets or SSE for instant updates.
- **AI quality:** build a small labelled set of real tickets and measure classification accuracy on every prompt change; track how much admins edit each draft (edit distance) as a quality signal; add retrieval over past resolved tickets once there are enough of them.
- **Cost:** a monthly token budget with alerts from `llm_logs`; a paid API tier (the free tier may use data for training).
- **Security:** httpOnly cookie sessions with refresh tokens, Redis-backed rate limits, scheduled clean-up of `request_logs`.
- **Product:** real file uploads to object storage, email notifications on replies, SLA timers per priority, canned responses, and a proper royalty breakdown per platform once that data exists.
