FROM python:3.12-slim

# - don't write .pyc files, - don't buffer stdout/stderr (so logs show up live)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# psycopg[binary] ships its own libpq, so no system packages are needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Invoke via `sh` so it works even when a bind mount shadows this layer with a
# host file that doesn't carry the executable bit (see DEBUGGING.md).
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
# shell form so $PORT (set by Render/Railway/Fly; defaults to 8000 for compose)
# is expanded at runtime.
CMD ["sh", "-c", "gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers ${WEB_CONCURRENCY:-3}"]
