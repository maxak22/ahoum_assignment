# Sessions Marketplace

A small marketplace where **Creators** publish bookable sessions and **Users** browse
and book them. Booking is the interesting part: it is concurrency-safe, so a
`capacity = 1` session can never be booked twice even under simultaneous requests.

> Stack: React (Vite) · Django + DRF · PostgreSQL · Google OAuth + JWT · Docker
> Compose · nginx. Built in small commits — `git log --oneline` shows the order.
>
> Docs: [DECISIONS.md](DECISIONS.md) · [DEBUGGING.md](DEBUGGING.md) ·
> [PROMPT_LOG.md](PROMPT_LOG.md)

---

## 1. Project overview

Two roles, one account type:

- Every account starts as a **User**: browse public sessions, view details, book,
  see active/past bookings, edit profile.
- A User can flip a self-serve switch on their profile to also become a **Creator**:
  create / edit / delete their own sessions and see per-session booking counts.
- "Creator" is **additive** — a Creator can still book other people's sessions.

All role and ownership rules are enforced in the Django backend. The React app
hides buttons for UX only; every protected action is re-checked server-side.

---

## 2. Architecture

```
                 ┌─────────────────────────────────────────────┐
   Browser  ───► │  nginx  (edge reverse proxy, port 80)        │
                 │    /            → frontend container         │
                 │    /api/, /admin/, /django-static/ → backend │
                 └───────────────┬─────────────────────────────┘
                                 │
              ┌──────────────────┴───────────────────┐
              ▼                                      ▼
   ┌────────────────────┐               ┌──────────────────────────┐
   │ frontend container │               │ backend container        │
   │ React build served │               │ Django + DRF + gunicorn  │
   │ by a small nginx   │               │ - Google ID token verify │
   └────────────────────┘               │ - SimpleJWT access/refr. │
                                        │ - session + booking APIs │
                                        └────────────┬─────────────┘
                                                     ▼
                                        ┌──────────────────────────┐
                                        │ db container: PostgreSQL │
                                        │ named volume `pgdata`    │
                                        └──────────────────────────┘
```

Backend apps:

| app        | responsibility                                              |
|------------|------------------------------------------------------------|
| `accounts` | custom `User` model, Google OAuth login, JWT, profile      |
| `catalog`  | `Session` model + CRUD APIs, public browse                 |
| `bookings` | `Booking` model + the concurrency-safe booking endpoint    |

### API endpoints

| method | path | auth | notes |
|---|---|---|---|
| `POST` | `/api/auth/google/` | — | Google ID token → `{access, refresh, user}` |
| `POST` | `/api/auth/dev-login/` | — | email sign-in; `{email, is_creator}` → tokens (gated by `ALLOW_EMAIL_LOGIN`) |
| `POST` | `/api/auth/refresh/` | — | `{refresh}` → `{access}` |
| `GET` `PATCH` | `/api/auth/me/` | user | read / update profile, `is_creator` toggle |
| `GET` | `/api/sessions/` | — | public sessions (`?mine=1` → your own, needs auth) |
| `POST` | `/api/sessions/` | **creator** | create |
| `GET` | `/api/sessions/{id}/` | — | detail |
| `PATCH` `PUT` `DELETE` | `/api/sessions/{id}/` | **owning creator** | 403 otherwise |
| `POST` | `/api/sessions/{id}/book/` | user | the concurrency-safe endpoint |
| `GET` | `/api/bookings/` | user | your bookings (`?status=active` \| `past`) |
| `POST` | `/api/bookings/{id}/cancel/` | user (owner) | frees the seat |

### Request / auth flow

1. Frontend gets a Google **ID token** via Google Identity Services.
2. `POST /api/auth/google/ { id_token }`.
3. Backend verifies the token signature against Google's public keys, checks
   `aud`/`iss`/`exp` and `email_verified`, then upserts the user keyed on the
   Google `sub`.
4. Backend returns its **own** `{ access, refresh, user }` (SimpleJWT).
5. Frontend sends `Authorization: Bearer <access>` on every call; on `401` it
   tries `POST /api/auth/refresh/`, and on failure logs out.

---

## 3. Setup

### Option A — Docker (recommended)

```bash
cp .env.example .env
python -c "import secrets; print('DJANGO_SECRET_KEY='+secrets.token_urlsafe(50))"  # paste into .env
docker compose up --build
```

- App: **http://localhost**
- Django admin: **http://localhost/admin** (`docker compose exec backend python manage.py createsuperuser`)

`.env.example` leaves the Google client id blank on purpose, so the app is
usable immediately: the sign-in page shows a **dev-login box** (email + a
"create as creator" checkbox). To use real
Google sign-in instead, see §5.

Populate the catalog with demo sessions (language, yoga, design, music,
interviews, cooking, …) and seed a couple of predictable users + JWTs:

```bash
docker compose exec backend python manage.py seed_sessions   # 8 demo sessions
docker compose exec backend python manage.py seed_dev_users   # dev users + printed JWTs
```

### Trying the two roles

1. Open http://localhost → **Sign in** → dev-login box.
2. Sign in as `creator@example.com` with **"create as creator"** checked →
   **Creator** tab → **New session** (capacity 1 is good for testing) → save.
3. Open a private window (or sign out), sign in as `user@example.com`
   (unchecked) → open that session → **Book**.
4. Book it again → you get the 409 "already booked". As a third user, booking
   the now-full session → 409 "fully booked". The creator can't book their own.
5. **My bookings** → cancel → the seat frees and you can rebook.

### Option B — local dev (no Docker)

You need Python 3.12 and a local PostgreSQL 16.

```bash
# --- backend ---
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DJANGO_SECRET_KEY=dev DJANGO_DEBUG=1 \
       POSTGRES_DB=sessions_marketplace POSTGRES_USER=sessions \
       POSTGRES_PASSWORD=sessions POSTGRES_HOST=localhost POSTGRES_PORT=5432
createdb sessions_marketplace   # or use psql
python manage.py migrate
python manage.py runserver 0.0.0.0:8000

# --- frontend (second terminal) ---
cd frontend
npm install
npm run dev        # http://localhost:5173, proxies /api -> :8000
```

---

## 4. Environment variables

See [.env.example](.env.example) for the full annotated list. Summary:

| var                        | used by            | purpose                                  |
|----------------------------|--------------------|------------------------------------------|
| `POSTGRES_*`               | db, backend        | database name / credentials / host       |
| `DJANGO_SECRET_KEY`        | backend            | Django cryptographic signing             |
| `DJANGO_DEBUG`             | backend            | `0` for any shared/deployed env; `1` only for local dev |
| `DJANGO_ALLOWED_HOSTS`     | backend            | host header allow-list                   |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | backend         | origins trusted for the admin login form |
| `CORS_ALLOWED_ORIGINS`     | backend            | browser origins allowed to call the API  |
| `JWT_ACCESS_TOKEN_LIFETIME_MIN` / `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | backend | token lifetimes |
| `GOOGLE_OAUTH_CLIENT_ID`   | backend            | audience the ID token is verified against (blank → Google login disabled) |
| `VITE_GOOGLE_CLIENT_ID`    | frontend (build)   | renders the Google button (blank → dev-login box shown) |
| `VITE_API_BASE_URL`        | frontend (build)   | API base path (relative, behind nginx)   |

Secrets live only in `.env` (git-ignored). `.env.example` holds placeholders and
is safe to commit.

---

## 5. Google OAuth setup

Optional — skip it and use the dev-login box (§3). For real Google sign-in:

1. Google Cloud Console → **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID → Web application**.
3. Authorized JavaScript origins: `http://localhost` (and `http://localhost:5173`
   if you run the Vite dev server).
4. No redirect URI is needed — we use the Google Identity Services **token**
   flow, not the redirect/code flow, so there is no callback URL to register.
5. Put the client id into `.env` as **both** `GOOGLE_OAUTH_CLIENT_ID` (backend
   verifies the token's `aud` against it) and `VITE_GOOGLE_CLIENT_ID` (frontend
   renders the button). Rebuild: `docker compose up --build`.
6. Add your Google account as a **Test user** on the OAuth consent screen while
   it is in "Testing" mode.

Once set, the frontend's `<GoogleLogin>` yields an ID token, `POST`s it to
`/api/auth/google/`, and the backend verifies it (signature via Google's JWKS,
`aud`, `iss`, `exp`, `email_verified`) before issuing our own JWT pair.

---

## 6. Docker usage

```bash
docker compose up --build        # start everything
docker compose up -d --build     # ... detached
docker compose logs -f backend   # tail one service
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
docker compose down              # stop, keep the volume (data survives)
docker compose down -v           # stop AND delete the db volume (wipes data)
```

---

## 7. Deployment (Vercel + Render)

The compose stack (§2) is one deployable unit — for a VPS you'd just run
`docker compose up -d` behind a TLS proxy. The hosted setup below splits it:
**frontend → Vercel** (static, global CDN), **backend + Postgres → Render**. The
SPA calls the Render API directly; `django-cors-headers` allows the Vercel
origin.

```
Browser ─► Vercel (static SPA)  ──CORS──►  Render (Django/gunicorn) ─► Render Postgres
```

Files: [`render.yaml`](render.yaml) (backend + DB blueprint),
[`frontend/vercel.json`](frontend/vercel.json) (Vite build + SPA fallback).

### 1. Backend on Render

1. **New → Blueprint → this repo.** Render reads `render.yaml`: a Docker web
   service (`backend/Dockerfile`) + a free PostgreSQL instance, wired by
   `DATABASE_URL`.
2. Prompted env vars: set `GOOGLE_OAUTH_CLIENT_ID`; leave
   `CORS_ALLOWED_ORIGINS` / `DJANGO_CSRF_TRUSTED_ORIGINS` as `https://example.com`
   placeholders (fixed in step 3).
3. First deploy runs migrations + `collectstatic` + `seed_sessions`. Note the
   URL, e.g. `https://sessions-backend.onrender.com`. Check `/api/health/`.
4. `RENDER_EXTERNAL_HOSTNAME` is injected automatically and added to
   `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS` in `settings.py`.

### 2. Frontend on Vercel

1. **New Project → this repo → Root Directory: `frontend`** (Framework
   auto-detects as Vite).
2. Environment variables:
   | name | value |
   |---|---|
   | `VITE_GOOGLE_CLIENT_ID` | your Google client id |
   | `VITE_API_BASE_URL` | `https://sessions-backend.onrender.com/api` (your Render host) |
   | `VITE_ENABLE_EMAIL_LOGIN` | `1` (so the email form shows next to Google) |
3. Deploy. Note the URL, e.g. `https://sessions-xyz.vercel.app`.

### 3. Wire the two together

- **Render** → set `CORS_ALLOWED_ORIGINS` = your Vercel URL
  (`https://sessions-xyz.vercel.app`, no trailing slash) → redeploy. Auth is a
  bearer token, not a cookie, so CORS is the only cross-origin setting needed.
- **Google Cloud Console** → the OAuth client → **Authorized JavaScript
  origins** → add `https://sessions-xyz.vercel.app`.
- Sign-in options on the deployed demo:
  - **Google** — add your account as a **Test user** on the consent screen.
  - **Email** (passwordless) — `render.yaml` sets `ALLOW_EMAIL_LOGIN=1` and you
    add `VITE_ENABLE_EMAIL_LOGIN=1` on Vercel, so a reviewer can sign in without
    Google. Drop both to make it Google-only.

### Notes

- Render's **free web service sleeps after 15 min idle** (~40 s cold start on the
  next request). Fine for review; for always-on use Render's paid tier, or
  **Railway** (deploy from repo + Postgres plugin, no cold start, ~free on the
  monthly credit for light traffic — same env vars).
- Render's **free Postgres expires** after its trial window; export/recreate or
  upgrade for anything long-lived.
- Data persistence: Render Postgres is a managed, always-on instance — backend
  redeploys don't touch it. (Locally it's the `pgdata` volume, §8.)

---

## 8. Database persistence

Postgres data is stored in a named Docker volume (`pgdata`) declared in
`docker-compose.yml`, mounted at `/var/lib/postgresql/data`. Restarting or
rebuilding the application containers does **not** touch it. Data is only lost if
you explicitly run `docker compose down -v` or `docker volume rm`.

---

## 9. Running tests

```bash
docker compose exec backend python manage.py test          # whole suite
docker compose exec backend python manage.py test accounts # one app
```

Tests run against a real PostgreSQL test database (row-level locking and partial
unique indexes do not behave the same on SQLite). Current count: **43 tests**.

| area | file | notable cases |
|---|---|---|
| auth / errors | `accounts/tests/test_auth.py` | 401 no token, 401 malformed token, **401 expired token**, OAuth failures (unverified email, invalid token), email-login 404 when disabled |
| authorization | `catalog/tests/test_authorization.py` | normal user → **403** on create; creator A → **403** editing / deleting creator B's session |
| sessions | `catalog/tests/test_sessions.py` | visibility, validation, DB `CHECK` constraints |
| bookings | `bookings/tests/test_bookings.py` | double-book, full, started, own-session, cancel + rebook, cancel-auth |
| concurrency | `bookings/tests/test_concurrency.py` | see §9 |

---

## 10. Concurrency test

```bash
docker compose exec backend python manage.py test bookings.tests.test_concurrency
```

`bookings/tests/test_concurrency.py` is a `TransactionTestCase` with three tests:

| test | scenario | asserts |
|---|---|---|
| `test_two_concurrent_requests_for_the_last_seat` | `capacity=1`, 2 users, 2 threads released together by a `threading.Barrier`, both `POST /api/sessions/{id}/book/` | exactly one `201` and one `409`; active bookings `== 1`; `seats_taken == 1` |
| `test_many_concurrent_requests_never_oversell` | `capacity=3`, 12 concurrent users | exactly 3× `201`, 9× `409`; active `== 3`; `seats_taken == 3` |
| `test_a_naive_check_then_create_oversells` | same threads/barrier, but a naive unlocked `if seats_taken < capacity: create()` patched in | **both** succeed, session **oversold** — proof the test detects the bug our implementation avoids |

- **Why `TransactionTestCase` not `TestCase`:** `TestCase` wraps each test in a
  transaction it never commits, so worker threads (separate DB connections)
  can't see the setup rows and `SELECT ... FOR UPDATE` has nothing committed to
  lock. `TransactionTestCase` commits for real.
- **Why PostgreSQL:** SQLite ignores `FOR UPDATE` and locks coarsely.
- **Why the naive version oversells and ours doesn't:** see
  [DECISIONS.md](DECISIONS.md) → "Booking concurrency strategy".

Live demo against the real DB (not the test DB):

```bash
docker compose exec backend python manage.py demo_race
docker compose exec backend python manage.py demo_race --concurrency 20 --capacity 3
```

---

## 11. Performance

Nothing exotic — just the usual levers:

**Frontend**
- **Route-level code splitting** (`React.lazy`) — each page is its own chunk;
  the framework (`react`, `react-dom`, `react-router`) is a separate
  long-cached vendor chunk. `@react-oauth/google` + the Google GIS script load
  only on `/login`.
- **Self-hosted fonts** with `font-display: swap` and `unicode-range` (only the
  latin subset is downloaded); hashed assets are `Cache-Control: immutable`,
  `index.html` is `no-cache`.
- **nginx gzip** on JS/CSS/JSON/SVG — e.g. the vendor chunk is 165 KB raw,
  ~54 KB on the wire.

Cold load of `/` (catalog): DOMContentLoaded ~90 ms, ~180 KB transferred
(most of it fonts, cached after first visit).

**Backend**
- `CONN_MAX_AGE=60` — reuse Postgres connections instead of reconnecting per
  request.
- `select_related` on the catalog and bookings querysets (no N+1 on the nested
  creator / session).
- Composite indexes for the hot queries: `Session(is_public, start_at)` for the
  catalog, `Booking(user, status)` for "my bookings".
- WhiteNoise serves pre-compressed static files.

---

## 12. Known limitations

- **No HTTPS.** nginx serves plain HTTP on `:80`; TLS termination is out of
  scope. `SECURE_SSL_REDIRECT` / HSTS are therefore off.
- **Refresh token in `localStorage`** — XSS-exposed. See DECISIONS.md §1 for the
  `httpOnly`-cookie alternative and why it wasn't chosen here.
- **Stateless JWTs, no blacklist** — a logout or a role change only takes effect
  when the 15-minute access token expires.
- **`dev-login` endpoint** exists (guarded by `DJANGO_DEBUG`). Convenient for
  evaluation; must stay disabled in a real deployment.
- **No pagination / search / filtering** on the catalog or bookings lists.
- **Anyone can self-promote to Creator** instantly — fine for a demo, not for a
  real marketplace (no trust/spam controls).
- **Booking is all-or-nothing** — no waitlist, no hold/timeout, no partial
  group booking.
- **No email / calendar notifications.**
- **The concurrency test needs Postgres** — it `skipTest`s on other backends
  rather than failing, so a misconfigured runner could silently skip it.
- **`seats_taken` counter can drift in theory** if a booking row is deleted
  directly in the DB (bypassing `cancel_booking`); the `CHECK` constraint bounds
  it but doesn't repair it. A periodic reconcile job would fix that.

---

## 13. What I would improve with another day

- **Move auth to `httpOnly` refresh cookies** + short-lived in-memory access
  token, with CSRF protection on the refresh endpoint.
- **Token blacklist** (SimpleJWT's `token_blacklist` app) so logout and bans are
  immediate.
- **Reconcile command / DB trigger** to keep `seats_taken` provably equal to the
  count of active bookings, and a test that asserts the invariant after random
  book/cancel sequences.
- **Pagination + filtering** (`django-filter`, DRF pagination) on catalog and
  bookings; an index on `Session.start_at` and `Booking(user, status)`.
- **Frontend tests** — React Testing Library for the booking flow and the
  refresh-on-401 interceptor; a Playwright happy-path.
- **CI** — GitHub Actions running `manage.py test` (incl. the concurrency test)
  against a Postgres service container on every push.
- **Rate-limiting** the booking and auth endpoints (DRF throttling).
- **Observability** — structured logging, request ids, a real `/healthz` that
  checks the DB.
- **Creator onboarding** — an approval step instead of an instant self-serve
  toggle.
