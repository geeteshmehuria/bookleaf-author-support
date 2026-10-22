# BookLeaf Author Support Portal

Helps BookLeaf's support team answer author queries faster.

- **Authors** log in, see their books and royalties, raise tickets, and follow replies.
- **Admins** work one ticket queue, with an AI-suggested category, priority and draft reply.

**Live demo:** _coming soon_ · **API docs:** `/api/v1/docs` (Swagger)

> Work in progress. Sections marked _(in progress)_ are not built yet.

## Run locally

Needs Python 3.12, Node 20+, Docker Desktop (running), and optionally a free [Gemini API key](https://aistudio.google.com/apikey). Without a key the app still works; AI falls back to manual mode.

```bash
# 1. Database (Postgres in Docker; schema.sql runs on first start)
docker compose up -d

# 2. Backend  →  http://localhost:8000/api/v1/docs
cd backend
python -m venv .venv && .venv\Scripts\activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env                              # macOS/Linux: cp; then set JWT_SECRET and GEMINI_API_KEY
python -m app.seed                                  # 10 authors, 18 books, 2 admins, 6 sample tickets
uvicorn app.main:app --reload

# 3. Frontend  →  http://localhost:5173
cd frontend
copy .env.example .env
npm install && npm run dev
```

Tests (database must be running and seeded): `pip install -r requirements-dev.txt` then `pytest -q` in `backend/`.

## Test logins

| Role | Email | Password |
|---|---|---|
| Admin | `neha.admin@bookleaf.example.com` | `Admin@123` |
| Admin | `karan.admin@bookleaf.example.com` | `Admin@123` |
| Author | `sneha.kulkarni@email.com` (has a book in production) | `Author@123` |
| Author | `ananya.reddy@email.com` (royalty never paid) | `Author@123` |
| Author | `priya.sharma@email.com` (normal published books) | `Author@123` |

Every author in `data/bookleaf_sample_data.json` can log in with `Author@123`. Everyone uses the same login page; the role returned by the API decides where they land.

## Architecture decisions

| Decision | Why |
|---|---|
| FastAPI + Pydantic | Input validation and Swagger docs come built in |
| PostgreSQL, `schema.sql` as the single source of truth | Rules live in the database too: royalty paid + pending = earned, and a ticket's book must belong to its author |
| One `users` table with a role (author / admin) | One login flow; the role is read from the database on every request, never trusted from the token |
| Author data filtered by the token, never by an ID from the request | An author can't see someone else's books by editing the URL |
| JWT auth, bcrypt passwords | Stateless and simple; same error for wrong email or wrong password |
| One error format: `{"error": {"code", "message"}}` | Frontend handles every error the same way; no raw 500s reach the browser |
| AI runs after the ticket is saved | A slow or failing AI never blocks an author |
| Queue sorted by urgency: unresolved first, then Critical → Low, then oldest; rows waiting on us over 48 h are flagged red | The brief asks for urgent and old tickets to be easy to spot; 48 h is the reply time the team promises |
| Polling (5 s author, 10 s admin) instead of WebSockets | Simple, easy to explain, works on free hosting _(in progress)_ |
| React + Vite + shadcn/ui | Fast to build, accessible components we own; design notes in [`frontend/DESIGN.md`](frontend/DESIGN.md) |

## AI integration

**Model: Google Gemini**, set in `backend/.env`. Free tier, fast, and it can return strict JSON. Two settings so each job uses the cheapest model that does it well:

| Setting | Used for | Suggested |
|---|---|---|
| `GEMINI_CLASSIFY_MODEL` | category + priority (short, structured) | a Flash-Lite model |
| `GEMINI_MODEL` | reply drafts (quality matters) | a Flash model |

Model IDs change often; copy current ones from [AI Studio](https://aistudio.google.com). The key and model names live only in backend environment variables and never reach the browser.

**1. Classification** (`services/ai_classifier.py`): runs in the background after the ticket is saved, so the author never waits. One call returns `{category, priority, reasoning}` as JSON restricted to the 6 categories and 4 priorities, and the result is validated again in code. The prompt has a priority rubric from the brief (ISBN errors at least High; "no royalty for 6 months" above "update my bio"). The AI never overrules a category or priority an admin already set; its suggestion is kept beside the admin's choice.

**2. Draft reply** (`services/ai_drafts.py`): made when an admin opens a ticket, cached in `ticket_drafts`, and edited before sending. Replies started from a draft are marked `is_ai_drafted`. Prompt rules: acknowledge first, use the real numbers given, own BookLeaf's mistakes, give a timeline, end with a next step, never invent facts.

**Facts are computed in code, not by the model:** payout due dates (quarter end + 45 days), the ₹1,000 rollover threshold, and a "likely overdue" flag. The model is told to quote these, not calculate them. The sample data's last payouts are in 2025, so today's date is always passed in.

**Saving tokens** (about 550 tokens per classification, about 1,100 per draft):

- only the knowledge-base section for the ticket's category, not the whole knowledge base (`services/knowledge_base.py`)
- only the one book the ticket is about, not the author's other books
- the original query plus the last 3 messages, each capped in length
- drafts cached: reopening a ticket costs nothing; "Regenerate" is explicit
- the seed never calls the AI; sample tickets are pre-classified
- every call is logged in `llm_logs` (tokens, latency, outcome) so cost can be checked

**When the AI fails** (`services/llm.py`): 20 s timeout; one retry only for server errors or timeouts; no retry on 429 (quota used up). Then:

- the ticket is still created; keyword rules set the category and priority, marked "Keyword rules (AI unavailable)"
- the admin sees "AI draft unavailable" with the reason, and replies by hand
- "Classify with AI" re-runs it once the AI is back

To test it, set a wrong `GEMINI_API_KEY`.

**Privacy:** prompts carry the author's first name and the book's data only: no email, phone or city, and internal notes are never sent. On the free tier Google may use the data sent to improve its products; production should use a paid tier.

## API

Full interactive docs: http://localhost:8000/api/v1/docs. All paths start with `/api/v1`. Send `Authorization: Bearer <token>`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | `/health` | anyone | Server is up |
| POST | `/auth/login` | anyone | Email + password → token and user (with role) |
| GET | `/auth/me` | logged in | Current user |
| GET | `/books` | author | The logged-in author's books (in production first, then newest) |
| GET | `/books/{id}` | author | One of their books; another author's book returns 404 |
| POST | `/tickets` | author | Raise a query (`book_id: null` = General / Account level) |
| GET | `/tickets` | author | Their tickets, most recently updated first |
| GET | `/tickets/{id}` | author | One ticket with its thread (never internal notes); another author's returns 404 |
| POST | `/tickets/{id}/replies` | author | Reply on their ticket; reopens a Resolved ticket, 409 if Closed |
| GET | `/admin/tickets` | admin | Queue. Filters: `status`, `category`, `priority` (repeatable), `assigned` (any / me / unassigned), `created_from`, `created_to`, `q`; `sort` = urgency (default), oldest, newest, updated |
| GET | `/admin/tickets/{id}` | admin | Ticket with thread, internal notes, author profile and book data |
| PATCH | `/admin/tickets/{id}` | admin | Change status, override category / priority (AI suggestion kept), assign / unassign |
| POST | `/admin/tickets/{id}/notes` | admin | Internal note (never shown to the author) |
| POST | `/admin/tickets/{id}/replies` | admin | Reply to the author; first reply moves Open → In Progress |
| GET | `/admin/tickets/{id}/draft` | admin | AI-drafted reply (made once, then cached). `available: false` + `reason` if AI is down |
| POST | `/admin/tickets/{id}/draft` | admin | Make a fresh draft |
| POST | `/admin/tickets/{id}/classify` | admin | Re-run AI classification and apply it (503 if AI is down) |
| GET | `/admin/team` | admin | Admins a ticket can be assigned to |
| GET | `/admin/summary` | admin | Ticket counts for the dashboard |

Status codes: 401 not logged in or bad token, 403 wrong role, 404 not found, 422 invalid input (lists each field).

## Known limitations

- No rate limit on login, and tokens can't be revoked before they expire (24 h).
- Login token is kept in `localStorage`; an httpOnly cookie would be safer.
- File attachments are UI only (the form shows the chosen file names; nothing is uploaded).
- Polling instead of WebSockets.
- Gemini free tier: low daily limits, and Google may use the data sent to it. Use a paid tier in production.
- The AI draft doesn't see internal notes (on purpose, so nothing private leaks); the admin adds that context when editing.
- Sample royalty data uses a flat amount per copy, not the 80/20 net-profit formula from the policy; the app shows the stored figures as they are.

## Troubleshooting

| Problem | Fix |
|---|---|
| Seed fails on `author_royalty_per_copy` | Old database: `docker compose down -v`, `docker compose up -d`, seed again |
| Port 5432 already in use | Another Postgres is running; stop it, or map `5433:5432` and update `backend/.env` |
| `No module named 'app'` | Run `uvicorn` from inside `backend/` |
| Login works but passwords don't match | `python -m app.seed --reset-passwords` |
