# Prompt Log

Important AI prompts used while building this project.

For each: tool/model · the prompt (summarised) · what was suggested · what I kept
· what I changed or rejected · how I verified it.

---

## P1 — Phase 1: architecture & project setup

- **Tool / model:** Claude Code (claude-sonnet-5)
- **Prompt (summary):** "Act as a senior full-stack pair programmer. Build a
  Sessions Marketplace (React + Django/DRF + Postgres + Google OAuth/JWT + Docker
  + nginx) step by step. Start with Phase 1: architecture, folder structure,
  database design, auth approach, booking concurrency approach, initial setup."
- **What was suggested:**
  - Three Django apps: `accounts`, `catalog`, `bookings`.
  - Google Identity Services **ID token** flow (not redirect/code flow), backend
    verifies the token and issues its own SimpleJWT pair.
  - Additive `is_creator` boolean on a custom `User` model rather than separate
    account types or Django Groups.
  - Booking safety = `transaction.atomic()` + `select_for_update()` on the
    session row + a partial unique index on `(user, session) WHERE status='active'`
    + a denormalised `seats_taken` counter guarded by a `CHECK` constraint.
  - Concurrency test with `TransactionTestCase` + `threading.Barrier`, run
    against Postgres.
  - Four containers (frontend, backend, db, nginx) with a named `pgdata` volume.
- **What I kept:** All of the above for Phase 1.
- **What I changed / rejected:** _(none yet — decisions recorded in
  DECISIONS.md; revisit if later phases surface problems)_
- **How I verified it:** Pending — nothing runnable yet. Verification happens per
  phase (migrations apply, tests pass, `docker compose up` works).

---

## P2 — Phase 3: authentication

- **Tool / model:** Claude Code (claude-sonnet-5)
- **Prompt (summary):** "Build Phase 3: flesh out the User model, then Google
  ID-token verification + SimpleJWT issue/refresh + `/api/auth/me/`. Write auth
  tests."
- **What was suggested:**
  - `services.py` split (verify / upsert / issue tokens) so views stay thin and
    logic is unit-testable by mocking `verify_oauth2_token`.
  - Account-linking branch: if a Google login's email already exists (admin-made
    account), attach `google_sub` to it instead of erroring on the unique email.
  - `seed_dev_users` management command that prints JWTs, so the API and the
    concurrency script can run without real Google credentials.
  - 8 auth tests incl. the two required error cases (401 no token, 401 bad token)
    plus OAuth-failure cases (unverified email, invalid token → 400).
- **What I kept:** All of it.
- **What I changed / rejected:** Renamed the auto-generated migration
  `0002_user_avatar_url_user_bio_user_full_name_and_more` → `0002_user_profile_fields`
  and repaired the `django_migrations` record.
- **How I verified it:** `python manage.py test accounts` (8 passing) + live curl
  against the running stack: 401 / 401 / 200 for no-token / bad-token / valid,
  `PATCH /me/` flips role to "creator", `/auth/refresh/` returns a new access
  token and 401s on a bad refresh.

---

## P3 — Phases 4-7: sessions, authorization, bookings, concurrency test

- **Tool / model:** Claude Code (claude-sonnet-5)
- **Prompt (summary):** "Build the catalog app (Session + CHECK constraints +
  CRUD), then IsCreator/ownership permissions, then the concurrency-safe booking
  service, then the race test. Explain the locking before coding it."
- **What was suggested:**
  - `seats_taken` denormalised counter + `CHECK (seats_taken <= capacity)` so
    overselling is impossible at the storage layer.
  - Two permission classes (`IsCreatorOrReadOnly` view-level, `IsOwnerOrReadOnly`
    object-level) rather than one.
  - `book_session()` = `transaction.atomic` + `select_for_update()` on the
    session row, checks, INSERT (partial unique index), `F()` counter bump.
  - Concurrency test as `TransactionTestCase` + `threading.Barrier`, plus a
    `test_a_naive_check_then_create_oversells` that patches in a naive version
    and shows it DOES oversell — proving the test has teeth.
  - `demo_race` management command as a runnable script for live demos.
- **What I kept:** All of it.
- **What I changed / rejected:** Added an explicit `Booking.objects.filter(...)
  .exists()` early check in `book_session` — see "AI got wrong" #3 below.
- **How I verified it:** `manage.py test` (40 passing), the 3 concurrency tests
  green, `demo_race --concurrency 20 --capacity 3` → exactly 3 OK / 17 rejected /
  verdict "safe", and live curl of every booking rule (double-book, full,
  started, own-session).

---

## What AI got wrong / what I corrected

1. **Entrypoint made non-executable by the bind mount.** The first Dockerfile
   used `RUN chmod +x /app/entrypoint.sh` + `ENTRYPOINT ["/app/entrypoint.sh"]`.
   That works for a plain image, but the moment we added a `./backend:/app` dev
   bind mount the container crash-looped with `exec /app/entrypoint.sh:
   permission denied` — the host file isn't executable and the mount shadows the
   image's version. Corrected to `ENTRYPOINT ["sh", "/app/entrypoint.sh"]` and
   set the bit on the host file. Full write-up in DEBUGGING.md (D1).

2. **Ugly auto-generated migration name.** `makemigrations` produced
   `0002_user_avatar_url_user_bio_user_full_name_and_more.py`. Left as-is it
   makes the history hard to read. I renamed the file to
   `0002_user_profile_fields.py`, then had to fix the `django_migrations` table
   (delete the stale row, re-`--fake` the renamed one) because Django tracks
   applied migrations by name. Lesson: pass `makemigrations -n <name>` up front.

3. **Wrong 409 message on a double-book of a full session.** The first
   `book_session` relied entirely on the partial unique index to reject a repeat
   booking. But when `capacity == 1` and the same user re-books, the
   `seats_taken >= capacity` check fires *first*, so the user saw "This session
   is fully booked" instead of "You already have an active booking". Found it
   with a live curl, not a test (the test only checked the 409 status). Fix:
   added an explicit `Booking.objects.filter(user, session, status=active)
   .exists()` check before the capacity check, purely for the message — the
   unique index is still the race-safe guard.
