FROM python:3.12-slim

# - don't write .pyc files, - don't buffer stdout/stderr (so logs show up live)
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# psycopg[binary] ships its own libpq, so no system packages are needed.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# entrypoint runs migrations, then execs the CMD (gunicorn by default).
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000", "--workers", "3"]
