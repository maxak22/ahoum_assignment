#!/bin/sh
set -e

# In compose, Postgres is already healthy (depends_on: service_healthy). On a
# managed host the DB is a separate always-on service. Either way it's up.
echo "Applying database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

# Optional: seed the catalog with demo sessions on a fresh deploy.
if [ "$SEED_DEMO_DATA" = "1" ]; then
    echo "Seeding demo sessions..."
    python manage.py seed_sessions || true
fi

exec "$@"
