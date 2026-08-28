# Debugging Log

Real problems hit while building, in the order we hit them. Each entry:
symptom → diagnosis → root cause → fix → verification.

---

## D1 — backend container crash-loops with `exec /app/entrypoint.sh: permission denied`

**Symptom.** After adding a dev bind mount (`volumes: ./backend:/app`) to the
`backend` service in `docker-compose.yml`, the container went into a restart loop.
`docker compose logs backend` showed only:

```
exec /app/entrypoint.sh: permission denied
```

The same image had started fine one phase earlier, before the bind mount.

**Diagnosis.** The image was built with `RUN chmod +x /app/entrypoint.sh`, so the
copy of the script *inside the image* was executable. Adding `./backend:/app` as a
bind mount mounts the host directory **on top of** `/app`, hiding the image's
version of every file under it — including the `chmod`-ed entrypoint. The
container then tries to exec the *host* `entrypoint.sh`, which was created by the
editor without the executable bit (`-rw-r--r--`).

**Root cause.** A bind mount shadows the image layer. Any file permission or file
baked into `/app` at build time is invisible once the host directory is mounted
there; only what's on the host counts.

**Fix.** Two changes so it can't recur:

1. `backend/Dockerfile`: invoke the script through `sh` instead of relying on the
   executable bit —
   `ENTRYPOINT ["sh", "/app/entrypoint.sh"]` (removed the `RUN chmod`).
2. `chmod +x backend/entrypoint.sh` on the host and commit the bit, so a direct
   `./entrypoint.sh` still works too.

**Verification.**

```
$ chmod +x backend/entrypoint.sh
$ docker compose up -d --build
$ docker compose ps
untitledfolder17-backend-1   ...   "sh /app/entrypoint.…"   Up 8 seconds
$ docker compose logs backend | tail
[gunicorn] Listening at: http://0.0.0.0:8000
```

Container stays up; migrations run; `/api/health/` returns 200.

---

## D2 — `makemigrations` says "No changes detected" after editing a model

**Symptom.** In Phase 3 we added fields to `accounts/models.py`, then ran
`docker compose exec backend python manage.py makemigrations accounts` and got:

```
No changes detected in app 'accounts'
```

The edited file was clearly on disk on the host.

**Diagnosis.** At that point `docker-compose.yml` had **no bind mount** for the
backend — the image was built with `COPY . .`, so the container was running a
*frozen copy* of the code from image-build time. `docker compose exec` runs
inside that container, against the frozen copy, which had the old model.

**Root cause.** Editing files on the host does not change a running container
unless the directory is bind-mounted (or the image is rebuilt).

**Fix.** Added a dev bind mount and live reload to the `backend` service:

```yaml
    command: gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3 --reload
    volumes:
      - ./backend:/app
```

(This is also what triggered D1.)

**Verification.** After `docker compose up -d --build`, the same
`makemigrations` command reported the new fields and wrote
`0002_user_profile_fields.py`. Editing a view now takes effect on the next
request without a rebuild.

---

## D3 — wrong error message when re-booking a full session

**Symptom.** Live-testing the booking endpoint (not caught by a test): a user
who already had an active booking for a `capacity = 1` session tried to book it
again and got

```
409  {"detail": "This session is fully booked."}
```

Expected: `"You already have an active booking for this session."`

**Diagnosis.** `book_session` relied entirely on the partial unique index to
reject a repeat booking — there was no explicit "already booked" check. The
checks ran in this order: started → **full** → INSERT (unique index). With
`capacity = 1` and the user's own booking filling the single seat,
`seats_taken >= capacity` was true, so `SessionFull` was raised before the
INSERT that would have hit the unique index and produced the right message.

**Root cause.** Correct behaviour (no double booking), wrong diagnostic — the
two failure modes were entangled because the only double-booking guard was the
DB constraint, reached last.

**Fix.** Added an explicit early check in `bookings/services.py`, *before* the
capacity check, purely for the message:

```python
already = Booking.objects.filter(
    user=user, session=session, status=Booking.Status.ACTIVE
).exists()
if already:
    raise AlreadyBooked()
```

The partial unique index is still the race-safe authority (the `INSERT` is still
wrapped in `try/except IntegrityError -> AlreadyBooked`); this check just makes
the common case say the right thing.

**Verification.**

```
$ curl -s -XPOST -H "Authorization: Bearer $U1" http://localhost/api/sessions/$SID/book/
{"detail":"You already have an active booking for this session."}   # 409
```

`bookings.tests.test_bookings` still green (11 tests); the concurrency tests
(which race *different* users) unaffected.

---

## D4 — nginx gzip config edited but responses still uncompressed

**Symptom.** Added `gzip on` + `gzip_types` to `nginx/default.conf`,
`docker compose up -d` reported no changes, and responses still came back
uncompressed. `docker compose exec nginx cat /etc/nginx/conf.d/default.conf`
showed the new directives, but `nginx -T` (the *effective* config) did not.

**Diagnosis.** `nginx/default.conf` is bind-mounted into the container.
`docker compose up -d` only recreates a container when its **compose-level**
config changes (image, env, ports, volume list) — editing the *contents* of a
mounted file is invisible to it. And nginx doesn't watch its files, so the
already-running process kept serving the old config.

**Root cause.** Bind-mount content changes need an explicit reload/recreate.

**Fix.**

```
docker compose restart nginx          # reloads the mounted file
# or, to be certain:
docker compose up -d --force-recreate nginx
```

A fresh `docker compose up --build` (what a reviewer runs) always reads the
current file, so this only bites during iterative local edits.

**Verification.**

```
$ docker compose exec nginx nginx -T | grep 'gzip on'
gzip on;
$ curl -s -D- -H 'Accept-Encoding: gzip' -o /dev/null http://localhost/assets/react-vendor-*.js | grep -i content-encoding
content-encoding: gzip
```

react-vendor chunk over the wire: 165 KB → 54 KB.
