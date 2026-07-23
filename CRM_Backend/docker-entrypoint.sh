#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "Seeding demo data..."
  python manage.py seed || true
fi

exec "$@"
