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
