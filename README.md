# BookLeaf Author Support & Communication Portal

A web app that helps BookLeaf Publishing handle author support queries faster.

- **Author portal:** authors log in, see their books and royalties, raise support tickets, and see replies.
- **Admin portal:** the support team sees all tickets, with AI-suggested category, priority, and a draft reply.

> **Status:** work in progress, built phase by phase. Sections marked _(coming soon)_ will be filled in as each phase is finished.

---

## Tech stack

| Part | Tool |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Pydantic |
| Database | PostgreSQL 15 (runs in Docker) |
| Frontend | React 19, Vite, Tailwind CSS, React Router |
| AI | Google Gemini API |
| Auth | JWT tokens, passwords hashed with bcrypt |

---

## Project structure

```
bookleaf/
├── backend/
│   ├── app/
│   │   ├── core/        # settings (reads .env)
│   │   ├── routers/     # API endpoints
│   │   ├── services/    # business logic + AI calls (coming soon)
│   │   ├── models/      # database models (coming soon)
│   │   ├── schemas/     # request/response validation (coming soon)
│   │   └── main.py      # FastAPI app entry point
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── services/api.js   # one helper for all API calls (adds the login token)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── .env.example
├── data/
│   └── bookleaf_sample_data.json   # 10 authors, 18 books (seed data)
├── schema.sql           # database tables, created automatically by Docker
└── docker-compose.yml   # local PostgreSQL
```

---

## Requirements

Install these first:

| Tool | Version | Check with |
|---|---|---|
| Python | **3.12** (3.13+ may fail to install some packages) | `python --version` |
| Node.js | 20, 22 or 24 (LTS) | `node -v` |
| Docker Desktop | any recent version, **must be running** | `docker info` |
| Git | any | `git --version` |
| uv (optional, recommended) | any | `uv --version` |

You also need a **Gemini API key** (free) from [Google AI Studio](https://aistudio.google.com/apikey). The app still runs without it; AI features fall back to manual mode.

---

## Run it locally

You need **three terminals**: one for the database, one for the backend, one for the frontend.

### 1. Clone the repo

```bash
git clone <repo-url>
cd bookleaf
```

### 2. Start the database

Make sure Docker Desktop is open and shows **Engine running**, then from the project root:

```bash
docker compose up -d
docker compose ps
```

The `PORTS` column must show `0.0.0.0:5432->5432/tcp`.

On first start, Docker runs `schema.sql` and creates all tables inside the `app` schema. Check it:

```bash
docker compose exec db psql -U postgres -d bookleaf_db -c "\dt app.*"
```

You should see 9 tables.

### 3. Start the backend

```bash
cd backend
```

Create a virtual environment with Python 3.12 and install packages.

**With uv (recommended):**
```bash
uv venv .venv --python 3.12
```

**Without uv:**
```bash
python -m venv .venv          # make sure this python is 3.12
```

Activate it:
```bash
# Windows (PowerShell)
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate
```

Install packages:
```bash
uv pip install -r requirements.txt     # or: pip install -r requirements.txt
```

Create your env file and fill in the values:
```bash
# Windows
copy .env.example .env

# macOS / Linux
cp .env.example .env
```

| Variable | What to put |
|---|---|
| `DATABASE_URL` | Leave as is for the Docker setup above |
| `JWT_SECRET` | Any long random string (32+ characters) |
| `GEMINI_API_KEY` | Your key from Google AI Studio |
| `GEMINI_MODEL` | The current Gemini Flash model name shown in AI Studio |
| `CORS_ORIGINS` | Leave as is for local (`http://localhost:5173`) |

Run the server (**from inside `backend/`**, or Python can't find the `app` folder):
```bash
uvicorn app.main:app --reload
```

Check it works:
- Health check: http://localhost:8000/api/v1/health → `"status": "healthy"`
- API docs (Swagger): http://localhost:8000/api/v1/docs

### 4. Load the sample data _(coming soon)_

A seed script will load the 10 authors and 18 books from `data/bookleaf_sample_data.json` and create test logins. Safe to run more than once.

### 5. Start the frontend

In a new terminal:
```bash
cd frontend
copy .env.example .env      # macOS / Linux: cp .env.example .env
npm install
npm run dev
```

Open http://localhost:5173. You should see the BookLeaf Portal page with **Status: healthy**, which means the frontend can talk to the backend.

---

## Test logins _(coming soon)_

| Role | Email | Password |
|---|---|---|
| Author | _added after the seed phase_ | |
| Admin | _added after the seed phase_ | |

---

## Common problems

| Problem | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'app'` | `uvicorn` was run from the wrong folder | `cd backend` first |
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop is not running | Open Docker Desktop, wait for "Engine running" |
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Another Postgres (Docker or Windows) is using port 5432 | Stop it, or change `"5432:5432"` to `"5433:5432"` in `docker-compose.yml` and `localhost:5433` in `backend/.env` |
| `PORTS` shows only `5432/tcp` | Container was created during a failed start | `docker compose down` then `docker compose up -d` |
| Tables missing after editing `schema.sql` | Docker runs `schema.sql` only when the database is first created | `docker compose down -v` (**deletes all DB data**) then `docker compose up -d` |
| Package install fails | Python is 3.13 or newer | Recreate `.venv` with Python 3.12 |
| Frontend shows "Error connecting to API" | Backend is not running, or wrong `VITE_API_URL` | Start uvicorn; check `frontend/.env` |
| Port 8000 already in use | Another app is on 8000 | Stop it, or run `uvicorn app.main:app --reload --port 8001` and update `VITE_API_URL` |

---

## Security notes

- `.env` files are in `.gitignore` and are **never** committed. Only `.env.example` files are in the repo.
- The Gemini API key is used **only by the backend**. It is never sent to the browser.

---

## Coming in later phases

- API endpoint list
- Architecture decisions and reasons
- How the AI works (prompts, saving tokens, what happens when AI is down)
- Live demo link
- Known limitations and future improvements
