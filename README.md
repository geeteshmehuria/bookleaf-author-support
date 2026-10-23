# BookLeaf Author Support Portal

An author support portal with AI help for BookLeaf's operations team.

- **Authors:** see their books and royalties, raise support queries, follow replies live.
- **Admins:** one ticket queue with AI category, AI priority and an AI-drafted reply.

| | |
|---|---|
| **Live demo** | https://bookleaf-author-support-coral.vercel.app (free plan: the first request may take ~1 min while the API wakes up) |
| **API docs (Swagger)** | https://bookleaf-api-nvn1.onrender.com/api/v1/docs |
| **Write-up** | [WRITEUP.md](WRITEUP.md) |
| **Tests, security, deploy, troubleshooting** | [docs/OPERATIONS.md](docs/OPERATIONS.md) |

## Test logins

| Role | Email | Password |
|---|---|---|
| **Admin** | `neha.admin@bookleaf.example.com` | `Admin@123` |
| **Author** | `sneha.kulkarni@email.com` | `Author@123` |

- One login page for both; the account's role decides where you land.
- Every author in `data/bookleaf_sample_data.json` also works with `Author@123`.
- Second admin, to test assigning: `karan.admin@bookleaf.example.com` / `Admin@123`.

## Quick review path (5 minutes)

1. Log in as **Sneha** → **My books** → raise a query under **Support**.
2. In a **private/incognito window or another browser**, log in as **Neha** → the new ticket appears in the queue with an AI category and priority.
3. Open it → check the **AI-drafted reply** → **Use this draft** → edit → **Send**.
4. Back in Sneha's window → the reply shows up without a page refresh.
5. As Neha: change status, override category/priority, add an internal note, **Assign to me**.

To see the AI fallback: run locally with a wrong `GEMINI_API_KEY`; tickets still get created and classified by keyword rules.

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

## Architecture decisions

| Decision | Why |
|---|---|
| React + Vite + shadcn/ui | Fast to build, accessible components |
| FastAPI + Pydantic | Input validation and Swagger docs built in |
| PostgreSQL (`schema.sql`) | Rules enforced in the DB too (paid + pending = earned; a ticket's book must belong to its author) |
| Role read from the DB on every request | A role in the token is never trusted |
| Author data filtered by the token, never by an ID in the URL | Another author's book or ticket returns 404 |
| AI classification runs after the ticket is saved | A slow or failing AI never blocks the author |
| One error format: `{"error": {"code", "message"}}` | The frontend handles every error the same way; no raw 500s |
| Polling: author 5 s, admin 10 s, slower while nothing changes | Near-real-time without WebSockets; works on free hosting |
| Queue sorted: unresolved → Critical to Low → oldest | Urgent and long-waiting tickets are at the top; red rows over 48 h |

## AI integration

### Model choice: Google Gemini

- **Cost:** free tier, so the demo needs no paid key.
- **Strict JSON:** a response schema means classification can only return valid categories and priorities.
- **Speed:** Flash answers in ~1-3 s while the admin opens a ticket.
- **Two models:** Flash-Lite (cheap) for classification, Flash for drafts.
- **Swappable:** every AI call goes through `services/llm.py`.

### Prompt strategy

| Feature | How |
|---|---|
| Classification | One call → `{category, priority, reasoning}` as JSON, validated again in code. Priority rubric from the brief (ISBN errors at least High). Admin can override |
| Draft reply | Made when an admin opens a ticket, editable before sending. Follows BookLeaf's tone rules: acknowledge first, real numbers, own mistakes, clear timeline, next step |
| Knowledge base | Only the policy section for the ticket's category is sent |
| Facts from code, not the model | Payout due dates, ₹1,000 threshold, "likely overdue" flag, production stage. The model quotes them; it doesn't calculate |

### Cost management (~550 tokens per classification, ~1,100 per draft)

- Only the knowledge-base section for the ticket's category
- Only the ticket's book, not all books
- Original query + last 3 messages, each capped in length
- Drafts cached; "Regenerate" is explicit
- Every AI call logged with token counts in `llm_logs`

### Error handling

| Situation | What happens |
|---|---|
| AI down, timeout or rate-limited | Ticket still created; keyword rules set category/priority |
| Draft can't be made | Admin sees "AI draft unavailable" and writes the reply by hand |
| AI back again | "Classify with AI" button re-runs classification |

### API key security

The key lives only in environment variables (`.env` is git-ignored) and is used only by the backend; it is never sent to the browser.

## API

All paths start with `/api/v1`. Send `Authorization: Bearer <token>`. Full docs in Swagger at `/api/v1/docs`.

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

## Known limitations and improvements

- File attachments are UI only (nothing is uploaded).
- Polling, not WebSockets.
- Login token in `localStorage`; can't be revoked before it expires (24 h).
- Rate limits are in memory (reset on restart; Redis needed for several servers).
- Sample royalties are a flat amount per copy, not the 80/20 formula; shown as stored.
- Gemini free tier has low daily limits.
