# Sessions Marketplace

A small marketplace where **Creators** publish bookable sessions and **Users** browse
and book them. Booking is the interesting part: it is concurrency-safe, so a
`capacity = 1` session can never be booked twice even under simultaneous requests.

> Status: built in phases. See the commit history for the order things were added.

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
# edit .env: set DJANGO_SECRET_KEY, GOOGLE_OAUTH_CLIENT_ID, VITE_GOOGLE_CLIENT_ID
docker compose up --build
# app:      http://localhost
# django admin: http://localhost/admin
```

### Option B — local dev (no Docker)

_Documented in a later phase once the backend/frontend exist._

---

## 4. Environment variables

See [.env.example](.env.example) for the full annotated list. Summary:

| var                        | used by            | purpose                                  |
|----------------------------|--------------------|------------------------------------------|
| `POSTGRES_*`               | db, backend        | database name / credentials / host       |
| `DJANGO_SECRET_KEY`        | backend            | Django cryptographic signing             |
| `DJANGO_DEBUG`             | backend            | `0` in any shared environment            |
| `DJANGO_ALLOWED_HOSTS`     | backend            | host header allow-list                   |
| `CORS_ALLOWED_ORIGINS`     | backend            | browser origins allowed to call the API  |
| `JWT_ACCESS_TOKEN_LIFETIME_MIN` / `JWT_REFRESH_TOKEN_LIFETIME_DAYS` | backend | token lifetimes |
| `GOOGLE_OAUTH_CLIENT_ID`   | backend            | audience the ID token is verified against |
| `VITE_GOOGLE_CLIENT_ID`    | frontend (build)   | renders the Google Sign-In button        |
| `VITE_API_BASE_URL`        | frontend (build)   | API base path (relative, behind nginx)   |

Secrets live only in `.env` (git-ignored). `.env.example` holds placeholders.

---

## 5. Google OAuth setup

1. Google Cloud Console → **APIs & Services → Credentials**.
2. **Create Credentials → OAuth client ID → Web application**.
3. Authorized JavaScript origins: `http://localhost` (and `http://localhost:5173`
   if you run the Vite dev server).
4. No redirect URI is needed — we use the Google Identity Services token flow, not
   the redirect/code flow.
5. Copy the client id into `.env` as both `GOOGLE_OAUTH_CLIENT_ID` and
   `VITE_GOOGLE_CLIENT_ID`.
6. Add your Google account as a **Test user** on the OAuth consent screen while it
   is in "Testing" mode.

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

## 7. Database persistence

Postgres data is stored in a named Docker volume (`pgdata`) declared in
`docker-compose.yml`, mounted at `/var/lib/postgresql/data`. Restarting or
rebuilding the application containers does **not** touch it. Data is only lost if
you explicitly run `docker compose down -v` or `docker volume rm`.

---

## 8. Running tests

```bash
docker compose exec backend python manage.py test          # whole suite
docker compose exec backend python manage.py test accounts # one app
```

Tests run against a real PostgreSQL test database (row-level locking and partial
unique indexes do not behave the same on SQLite). Current count: 40 tests.

The two required authorization/error cases and more live in
`accounts/tests/test_auth.py` (401 no token, 401 bad token, OAuth failures) and
`catalog/tests/test_authorization.py` (normal user → 403 on create, creator A →
403 on creator B's session / delete).

---

## 9. Concurrency test

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

## 10. Known limitations

_Filled in as we build. Current list:_

- Consent screen stays in Google "Testing" mode; real verification is out of scope.
- No email notifications / calendar invites on booking.
- No pagination on the catalog yet.
- Refresh token stored in `localStorage` (see DECISIONS.md for the trade-off).

---

## 11. What I'd improve with another day

_Filled in at the end._
