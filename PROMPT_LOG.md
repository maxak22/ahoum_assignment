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

## What AI got wrong / what I corrected

_At least two genuine examples will go here as they happen during the build._
