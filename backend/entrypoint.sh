#!/bin/sh
set -e

# compose waits for Postgres to be *healthy* before starting us (depends_on:
# condition: service_healthy), so by the time we get here the DB accepts
# connections and we can just migrate.
echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

exec "$@"
