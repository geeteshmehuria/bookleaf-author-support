# Operations: tests, security, deploy, troubleshooting

Back to the [README](../README.md).

## Tests

In `backend/`, `pip install -r requirements-dev.txt` then `pytest -q` (database running and seeded).

## Security

| Area | Protection |
|---|---|
| Passwords | bcrypt; same error for wrong email or wrong password |
| Login | Failed tries capped per account + IP (5), per account from any IP (10), per IP (20), per 15 min |
| Access | Role checked on every route; authors only see their own data |
| Input | Length limits on every field; bodies over 64 KB, or chunked (no Content-Length), rejected |
| Secrets | Only in env variables; `.env` git-ignored; AI key never sent to the browser |
| Browser | CORS limited to the frontend; security headers on the API; CSP, no-framing and nosniff on the frontend; HSTS in production |
| AI | Author text treated as data, not instructions; drafts never sent automatically |

**Visitor IP behind Render's proxy:** the API starts with `--proxy-headers --forwarded-allow-ips='*'` so rate limits see the visitor's IP, not the proxy's (otherwise every visitor shares one IP and 20 failed logins lock out everyone). Trusting `*` is safe only because Render's proxy is the only way in, and a client can still fake its IP; that's why one account also has a cap from any IP.

## Deploy

Live setup (all free plans):

| Part | Host | Notes |
|---|---|---|
| Database | [Neon](https://neon.tech) Postgres | Free plan doesn't expire |
| API | [Render](https://render.com) web service | Settings in `render.yaml` |
| Frontend | [Vercel](https://vercel.com) | Settings in `frontend/vercel.json` (SPA rewrite + security headers) |

1. **Neon:** create a project → copy the connection string (direct, not pooled).
2. **Render:** New → Blueprint → this repo (or a Web Service with the same settings as `render.yaml`). Set:
   - `DATABASE_URL` = the Neon string
   - `CORS_ORIGINS` = the Vercel URL (no trailing slash)
   - `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_CLASSIFY_MODEL`
   - `JWT_SECRET` is generated. On start the API creates the tables and seeds the sample data.
3. **Vercel:** import the repo, root directory `frontend`, env `VITE_API_URL` = `https://bookleaf-api-nvn1.onrender.com/api/v1`, deploy.
   If the API URL changes, update the `connect-src` entry in `frontend/vercel.json` too.
4. **Check the live site** (after any deploy that changes config or headers):
   - [ ] https://bookleaf-api-nvn1.onrender.com/api/v1/health returns 200 (the first call may take ~1 min)
   - [ ] `curl -I https://bookleaf-author-support-coral.vercel.app` shows the `Content-Security-Policy` header
   - [ ] a deep link such as https://bookleaf-author-support-coral.vercel.app/admin/tickets loads on refresh
   - [ ] as an admin: the queue cards and table load, and a ticket opens with its AI draft
   - [ ] as an author: My books, a book page, Support and a ticket thread load
   - [ ] the browser console shows no CSP (`Refused to …`) or CORS errors

Pushing to `main` redeploys both. The free API sleeps after 15 min idle (first request takes ~1 min).

## Troubleshooting

| Problem | Fix |
|---|---|
| Seed fails on `author_royalty_per_copy` | Old database: `docker compose down -v`, `docker compose up -d`, seed again |
| Port 5432 in use | Stop the other Postgres, or map `5433:5432` and update `backend/.env` |
| `No module named 'app'` | Run `uvicorn` from inside `backend/` |
| Passwords don't work | `python -m app.seed --reset-passwords` |
| Queue cards show "–" | Restart the backend so it runs the latest code |
