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
| AI runs after the ticket is saved | A slow or failing AI never blocks an author _(in progress)_ |
| Polling (5 s author, 10 s admin) instead of WebSockets | Simple, easy to explain, works on free hosting _(in progress)_ |
| React + Vite + shadcn/ui | Fast to build, accessible components we own; design notes in [`frontend/DESIGN.md`](frontend/DESIGN.md) |

## AI integration _(in progress)_

- **Model:** Google Gemini Flash. Free tier, fast, and it can return strict JSON. The model name is set in `.env`, so it can change without code changes.
- **Classification:** one call per new ticket returns `{category, priority, reasoning}`. The output is checked against the 6 allowed categories; anything invalid falls back to General Inquiry / Medium.
- **Draft reply:** generated when an admin opens a ticket, then cached in `ticket_drafts` (a Regenerate button makes a new one).
- **Saving tokens:** each call sends only the knowledge-base section for that ticket's category, the one relevant book record, and the last 2–3 messages. Never the whole knowledge base or full history.
- **When AI fails** (down, rate-limited, bad key): the ticket is still created, a keyword rule picks the category, and the admin sees "AI unavailable" with a working manual reply box.
- **Security:** the key lives only in backend environment variables and is never sent to the browser. Prompts include no author email or phone number.

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
| GET | `/admin/summary` | admin | Ticket counts for the dashboard |

Status codes: 401 not logged in or bad token, 403 wrong role, 404 not found, 422 invalid input (lists each field).

## Known limitations

- No rate limit on login, and tokens can't be revoked before they expire (24 h).
- Login token is kept in `localStorage`; an httpOnly cookie would be safer.
- File attachments are UI only (the form shows the chosen file names; nothing is uploaded).
- Polling instead of WebSockets.
- Gemini free tier: low daily limits, and Google may use the data sent to it. Use a paid tier in production.
- Sample royalty data uses a flat amount per copy, not the 80/20 net-profit formula from the policy; the app shows the stored figures as they are.

## Troubleshooting

| Problem | Fix |
|---|---|
| Seed fails on `author_royalty_per_copy` | Old database: `docker compose down -v`, `docker compose up -d`, seed again |
| Port 5432 already in use | Another Postgres is running; stop it, or map `5433:5432` and update `backend/.env` |
| `No module named 'app'` | Run `uvicorn` from inside `backend/` |
| Login works but passwords don't match | `python -m app.seed --reset-passwords` |
