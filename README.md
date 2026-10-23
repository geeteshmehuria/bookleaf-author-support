# BookLeaf Author Support Portal

An author support portal with AI help for BookLeaf's operations team.

- **Authors:** see their books and royalties, raise support queries, follow replies live.
- **Admins:** one ticket queue with AI category, AI priority and an AI-drafted reply.

| | |
|---|---|
| **Live demo** | _add URL after deploying (see [Deploy](#deploy))_ |
| **API docs (Swagger)** | Local: http://localhost:8000/api/v1/docs · Live: `<api-url>/api/v1/docs` (note: `/api/v1/docs`, not `/docs`) |
| **Write-up** | [WRITEUP.md](WRITEUP.md) |

## Test logins

| Role | Email | Password |
|---|---|---|
| **Admin** | `neha.admin@bookleaf.example.com` | `Admin@123` |
| **Author** | `sneha.kulkarni@email.com` | `Author@123` |

- One login page for both; the account's role decides where you land.
- Sneha is a good test author: 2 published books with pending royalty + 1 book still in production.
- Every author in `data/bookleaf_sample_data.json` also works with `Author@123` (e.g. `ananya.reddy@email.com`: royalty never paid).
- Second admin, to test assigning: `karan.admin@bookleaf.example.com` / `Admin@123`.

## Quick review path (5 minutes)

1. Log in as **Sneha** → **My books** → raise a query under **Support**.
2. In another window, log in as **Neha** → the new ticket appears in the queue with an AI category and priority.
3. Open it → check the **AI-drafted reply** → **Use this draft** → edit → **Send**.
4. Back in Sneha's window → the reply shows up without a page refresh.
5. As Neha: change status, override category/priority, add an internal note, **Assign to me**.

## What the brief asked for → where it is

Backend paths are under `backend/app/`, frontend paths under `frontend/src/`.

| Requirement | Where |
|---|---|
| Email/password login, authors see only their own data | `routers/auth.py`, `core/deps.py` |
| My Books (all 10 fields, books in production, zero royalty) | `pages/author/MyBooks.jsx`, `components/books/BookCard.jsx` |
| Raise a query (book or General, subject, description, attachment UI) | `pages/author/NewTicket.jsx` |
| My Tickets with live updates | `pages/author/MyTickets.jsx`, `TicketDetail.jsx` (polling) |
| Queue: filter by status, category, priority, date; urgent and old easy to spot | `pages/admin/Queue.jsx` (urgency sort, red rows over 48 h) |
| AI category + priority, admin can override | `services/ai_classifier.py` |
| AI draft from the knowledge base, editable before sending | `services/ai_drafts.py`, `services/knowledge_base.py` |
| Status, internal notes, assign to self | `pages/admin/TicketView.jsx`, `services/admin_tickets.py` |
| REST API, auth on every route, role checks, validation, docs | `routers/`, Swagger at `/api/v1/docs` |
| AI key safety, graceful failure, cost control | [AI integration](#ai-integration) |

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + shadcn/ui | Fast to build, accessible components |
| Backend | FastAPI + Pydantic | Validation and Swagger docs built in |
| Database | PostgreSQL (`schema.sql`) | Rules enforced in the DB too (paid + pending = earned; a ticket's book must belong to its author) |
| AI | Google Gemini (Flash / Flash-Lite) | See [why Gemini](#why-gemini) |
| Live updates | Polling | Simple, works on free hosting |

## Run locally

Needs **Python 3.12**, **Node 20+**, **Docker Desktop**. A [Gemini API key](https://aistudio.google.com/apikey) is optional: without it, the app works with keyword rules and manual replies.

```bash
# 1. Database
docker compose up -d

# 2. Backend → http://localhost:8000/api/v1/docs
cd backend
python -m venv .venv && .venv\Scripts\activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                           # macOS/Linux: cp. Set JWT_SECRET (and GEMINI_* for AI)
python -m app.seed                               # 10 authors, 18 books, 2 admins, 6 sample tickets
uvicorn app.main:app --reload

# 3. Frontend → http://localhost:5173
cd frontend
copy .env.example .env
npm install && npm run dev
```

**Tests:** in `backend/`, `pip install -r requirements-dev.txt` then `pytest -q` (database running and seeded).

## Architecture decisions

| Decision | Why |
|---|---|
| Role read from the DB on every request | A role in the token is never trusted |
| Author data filtered by the token, never by an ID in the URL | Another author's book or ticket returns 404 |
| AI classification runs after the ticket is saved | A slow or failing AI never blocks the author |
| One DB transaction per request | All of a request's changes are saved, or none |
| One error format: `{"error": {"code", "message"}}` | The frontend handles every error the same way; no raw 500s |
| Every request logged in `request_logs`, every AI call in `llm_logs` | Audit trail and cost tracking; passwords and tokens masked |
| Polling: author 5 s, admin 10 s, slowing to 3× while nothing changes | Near-real-time without WebSockets; pauses when the tab is hidden |
| Queue sorted by urgency: unresolved → Critical to Low → oldest | Urgent and long-waiting tickets are at the top |

## AI integration

### Why Gemini

- **Cost:** free tier, so the demo needs no paid key.
- **Strict JSON:** a response schema means classification can only return valid categories and priorities.
- **Speed:** Flash answers in ~1-3 s while the admin opens a ticket.
- **Two models:** `GEMINI_CLASSIFY_MODEL` (cheap, Flash-Lite) for triage, `GEMINI_MODEL` (Flash) for drafts.
- **Swappable:** every AI call goes through `services/llm.py`.

### What the AI does

| Feature | How |
|---|---|
| Classification | One call → `{category, priority, reasoning}` as JSON, validated again in code. Priority rubric from the brief (ISBN errors at least High). Never overrules an admin's choice |
| Draft reply | Made when an admin opens a ticket, then cached. Follows BookLeaf's tone rules: acknowledge first, real numbers, own mistakes, clear timeline, next step |
| Facts from code, not the model | Payout due dates, ₹1,000 threshold, "likely overdue" flag, production stage. The model quotes them; it doesn't calculate |
| General / account-level tickets | Prompt gets one short line per book, so the reply still has real numbers |
| Category changed | Cached draft is dropped and a fresh one is made with the right policy |

### Cost control (~550 tokens per classification, ~1,100 per draft)

- Only the knowledge-base section for the ticket's category
- Only the ticket's book, not all books
- Original query + last 3 messages, each capped in length
- Drafts cached; "Regenerate" is explicit
- Rate limits on AI calls; every call logged with tokens in `llm_logs`

### When the AI fails

| Situation | What happens |
|---|---|
| AI down, timeout or quota used up | Ticket still created; keyword rules set category/priority (shown as "Keyword rules") |
| Draft can't be made | Admin sees "AI draft unavailable" + the reason, and writes the reply by hand |
| AI back again | "Classify with AI" button re-runs classification |
| Retries | One retry for server errors/timeouts; none for 429 (quota) |

Test it: set a wrong `GEMINI_API_KEY`.

**Privacy:** prompts carry the author's first name and book data only; no email, phone or internal notes.

## API

All paths start with `/api/v1`. Send `Authorization: Bearer <token>`.

**Try it in Swagger:** open http://localhost:8000/api/v1/docs → call `POST /auth/login` with a test login → copy `access_token` → click **Authorize** → paste it.

| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | `/auth/login` | anyone | Email + password → token + user role |
| GET | `/auth/me` | logged in | Current user |
| GET | `/books` | author | My books |
| GET | `/books/{id}` | author | One of my books |
| POST | `/tickets` | author | Raise a query (`book_id: null` = General) |
| GET | `/tickets` | author | My tickets |
| GET | `/tickets/{id}` | author | One ticket with replies (no internal notes) |
| POST | `/tickets/{id}/replies` | author | Reply; reopens a Resolved ticket |
| GET | `/admin/tickets` | admin | Queue with filters + summary counts |
| GET | `/admin/tickets/{id}` | admin | Ticket, notes, author and book details |
| PATCH | `/admin/tickets/{id}` | admin | Status, category, priority, assignee |
| POST | `/admin/tickets/{id}/notes` | admin | Internal note |
| POST | `/admin/tickets/{id}/replies` | admin | Reply to the author |
| GET / POST | `/admin/tickets/{id}/draft` | admin | Get cached AI draft / make a new one |
| POST | `/admin/tickets/{id}/classify` | admin | Re-run AI classification |
| GET | `/admin/team` | admin | Admins to assign to |
| GET | `/health` | anyone | Server is up |

**Errors:** 401 not logged in · 403 wrong role · 404 not found · 409 ticket closed · 413 body too big · 422 invalid input (per field) · 429 rate limited · 503 AI unavailable.

## Security

| Area | Protection |
|---|---|
| Passwords | bcrypt; same error for wrong email or wrong password |
| Login | Failed tries capped per account + IP (5), per account from any IP (10), per IP (20), per 15 min |
| Access | Role checked on every route; authors only see their own data |
| Input | Length limits on every field; bodies over 64 KB, or chunked (no Content-Length), rejected |
| Secrets | Only in env variables; `.env` git-ignored; AI key never sent to the browser |
| Browser | CORS limited to the frontend; security headers on the API and the frontend site; HSTS in production |
| AI | Author text treated as data, not instructions; drafts never sent automatically |

**Visitor IP behind Render's proxy:** the API starts with `--proxy-headers --forwarded-allow-ips='*'` so rate limits see the visitor's IP, not the proxy's (otherwise every visitor shares one IP and 20 failed logins lock out everyone). Trusting `*` is safe only because Render's proxy is the only way in, and a client can still fake its IP; that's why one account also has a cap from any IP.

## Deploy

`render.yaml` creates the database, API and frontend on [Render](https://render.com) (free plans, Singapore region).

1. Push `main` to GitHub. Render → **New → Blueprint** → pick this repo.
2. Render asks for the `sync: false` values:
   - `bookleaf-api`: `CORS_ORIGINS` = `https://bookleaf-web.onrender.com` (no trailing slash), `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_CLASSIFY_MODEL`
   - `bookleaf-web`: `VITE_API_URL` = `https://bookleaf-api.onrender.com/api/v1`
3. **Apply.** The API creates the tables and seeds the sample data on start; `JWT_SECRET` is generated.
4. Check the real URLs on each service page. If Render added a suffix (name already taken), fix the two values above and redeploy `bookleaf-web` (the API URL is baked in at build time).
5. Test: open `<API URL>/api/v1/health`, then log in as an author and an admin.
6. Put both URLs at the top of this README.

Free plan notes: the API sleeps after 15 min idle (first request takes ~1 min); the free database expires 30 days after creation.

## Known limitations

- File attachments are UI only (nothing is uploaded).
- Polling, not WebSockets.
- Login token in `localStorage`; can't be revoked before it expires (24 h).
- Rate limits are in memory (reset on restart; Redis needed for several servers).
- `request_logs` has no automatic clean-up yet.
- Sample royalties are a flat amount per copy, not the 80/20 formula; shown as stored.
- Gemini free tier has low daily limits.

## Troubleshooting

| Problem | Fix |
|---|---|
| Seed fails on `author_royalty_per_copy` | Old database: `docker compose down -v`, `docker compose up -d`, seed again |
| Port 5432 in use | Stop the other Postgres, or map `5433:5432` and update `backend/.env` |
| `No module named 'app'` | Run `uvicorn` from inside `backend/` |
| Passwords don't work | `python -m app.seed --reset-passwords` |
| Queue cards show "–" | Restart the backend so it runs the latest code |
