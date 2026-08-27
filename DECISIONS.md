# Engineering Decisions

Each entry: the ambiguity, the options weighed, what we chose, and what it costs.

---

## 1. Authentication architecture

**Problem / ambiguity.** "Google OAuth + JWT" can mean several things. Where does
the OAuth dance happen, who holds the Google client secret, and what token does
the browser actually carry on API calls?

**Options considered.**

| Option | Notes |
|---|---|
| A. Redirect / authorization-code flow, backend does the exchange | Backend needs the Google client secret, must host a redirect URI, must handle `state`/PKCE and the redirect round-trip. Closer to classic server-rendered apps. |
| B. Google Identity Services token flow: browser gets a Google **ID token**, backend verifies it, backend issues its own JWT | No client secret anywhere on the client, no redirect URI, no Google refresh-token storage. Backend stays the identity authority. |
| C. Use Google tokens directly as API credentials | Couples our API to Google token formats/lifetimes, forces a Google call (or JWKS cache) on every request, no clean way to add our own claims (role). |

**Decision.** Option B. The React app uses Google Identity Services to obtain an
ID token and `POST`s it once to `/api/auth/google/`. The backend calls
`google.oauth2.id_token.verify_oauth2_token(...)` (checks signature against
Google's rotating public keys, plus `aud` = our client id, `iss`, `exp`), requires
`email_verified`, upserts a `User` keyed on the Google `sub`, and returns a
first-party **SimpleJWT** access/refresh pair. Every subsequent request carries
`Authorization: Bearer <access>`; our own `role`/`id` claims live in that token.

**Trade-off.** We now own token lifecycle, rotation, and refresh-endpoint
security instead of delegating to Google. Access tokens are stateless, so a
logout or a role change is not visible until the short (15 min) access token
expires — acceptable for this app, and the refresh token can be blacklisted if we
add that later. The refresh token is stored in `localStorage` for simplicity,
which is XSS-exposed; an `httpOnly` cookie would be safer but adds CSRF handling
and complicates the pure-SPA + nginx setup. Documented as a known limitation.

---

## 2. Booking concurrency strategy

**Problem / ambiguity.** Capacity must never be exceeded and a user must not
double-book, even when two requests for the last seat arrive at the same
millisecond. A `if remaining > 0: create()` check has a race: two requests both
read "1 left" before either writes.

**Options considered.**

| Option | Why not / why |
|---|---|
| A. Naive `count() < capacity` then `create()` | Classic check-then-act race under `READ COMMITTED`. Rejected — this is exactly what the assignment forbids. |
| B. `SELECT ... FOR UPDATE` on the session row inside `transaction.atomic()` | Serializes the critical section per session. The second request blocks until the first commits, then re-reads fresh state. Simple, local, no retry loop. |
| C. `SERIALIZABLE` isolation | Correct, but pushes conflicts to commit time as `SerializationFailure`, so every write path needs a retry loop. More machinery than this one hot row needs. |
| D. Postgres advisory locks (`pg_advisory_xact_lock(session_id)`) | Works, but locks on an integer that isn't tied to a real row; easy to misuse, and reviewers have to trust the key scheme. |
| E. Constraints only (partial unique index + `CHECK`) | Prevents the bad *state*, but callers get raw `IntegrityError`s and there's a lost-update hazard on a counter column. Good as a backstop, not as the primary mechanism. |

**Decision.** B as the primary mechanism, with E as defense in depth.

The booking service does, inside one `transaction.atomic()`:

1. `session = Session.objects.select_for_update().get(pk=id)` — takes a
   **row-level exclusive lock** on that session row. A second transaction issuing
   the same statement **blocks** until this one commits or rolls back.
2. reject if `session.start_at <= now` (already started),
3. reject if `session.seats_taken >= session.capacity` (full) — this read is now
   *after* the lock, so it sees the latest committed value,
4. `Booking.objects.create(user, session, status="active")` — the partial unique
   index `(user, session) WHERE status='active'` turns a double-book into an
   `IntegrityError` we convert to `409`,
5. `session.seats_taken = F("seats_taken") + 1; save()` — the
   `CHECK (seats_taken <= capacity)` constraint is the final backstop.

**Why the naive version oversells and ours does not.** Under `READ COMMITTED`
(Django/Postgres default) two un-locked transactions can both run step 3's read,
both see `seats_taken = 0 < 1`, both insert. With `select_for_update()` only one
transaction is ever between steps 1 and 5 for a given session; the other waits,
then wakes up and reads `seats_taken = 1` and returns `409`. The `CHECK` and the
partial unique index mean that even if the lock were removed, the extra write
would fail at the storage layer rather than corrupt data — the lock's job is to
turn those failures into clean, predictable HTTP responses and to prevent
lost updates on the counter.

**Trade-off.** Booking requests for the *same* session are serialized, so a
wildly popular session's bookings process one-at-a-time. That is fine here
(bookings are cheap and rare relative to reads, and different sessions don't
contend). We also carry a denormalized `seats_taken` counter that must be kept in
sync on every book/cancel — extra code and a place bugs can hide — in exchange
for a hard database-level guarantee that capacity can't be exceeded.

---

## 3. Database constraints vs application validation

**Problem / ambiguity.** The rules ("capacity > 0", "one active booking per
user/session", "seats ≤ capacity") could be enforced in Django serializers,
in the database, or both. Where should the source of truth live?

**Options considered.**

- **App-only:** all checks in DRF serializers / service functions. Readable,
  easy to unit-test, gives nice error messages — but a bug, a shell script, a
  data migration, or a second writer can violate the invariant, and nothing
  stops it.
- **DB-only:** everything as `CHECK` / `UNIQUE` constraints. Bulletproof, but
  users get opaque `IntegrityError`s and the API layer can't give friendly,
  field-level messages.
- **Both, with clear roles.**

**Decision.** Both. The database owns the invariants that must *never* be false:

- `CHECK (capacity > 0)`, `CHECK (duration_minutes > 0)`,
- `CHECK (seats_taken >= 0 AND seats_taken <= capacity)`,
- partial unique index `(user, session) WHERE status = 'active'`.

The application owns everything user-facing: friendly validation messages,
the "session already started" rule (time-based, not a stored invariant), role and
ownership checks, and *catching* the DB errors above to return the right HTTP
status (`400` / `409` / `403`).

**Trade-off.** Some rules are expressed twice (e.g. capacity is validated in the
serializer *and* checked in the DB), so they can drift if we edit one and forget
the other. We accept that duplication because the two layers serve different
purposes: the app layer is for humans, the DB layer is for correctness.

---

## 4. Role model: one account type with an additive Creator flag

**Problem / ambiguity.** "Two roles: User and Creator." Two separate models? A
Django `Group`? A choice field? Can one person be both?

**Options considered.**

- **Separate `UserAccount` / `CreatorAccount` models** — duplicated auth/profile
  logic, awkward when the same person wants to both sell and book.
- **Django `Groups` / `Permissions`** — flexible and built-in, but heavier than a
  two-state distinction needs, and the permission wiring is less obvious to a
  reader.
- **`is_creator` boolean on the custom `User`** — a Creator is a User with one
  extra capability.

**Decision.** `is_creator = BooleanField(default=False)` on the custom `User`.
Users self-serve toggle it from the Profile page (`PATCH /api/auth/me/`). DRF
permission classes enforce it: `IsCreator` (403 for non-creators) on
create/update/delete session endpoints, plus an object-level owner check so a
Creator can only mutate their *own* sessions. The API exposes a derived
`role` string (`"creator"` / `"user"`) for the frontend's convenience.

**Trade-off.** No graduated permissions or admin approval step — anyone can
become a Creator instantly, which is right for a demo but not for a real
marketplace (spam, trust). Moving to `Groups` later is a migration plus swapping
the permission classes; the API contract (`role` on the user object) would not
change.
