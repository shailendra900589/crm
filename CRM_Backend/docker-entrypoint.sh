#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Ensuring platform Super Admin (Rahul)..."
python manage.py ensure_superadmin || true

echo "Cleaning legacy seed form junk (GST4000/Retail)..."
python manage.py clean_seed_form_data || true

if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "Seeding demo data..."
  python manage.py seed || true
fi

exec "$@"
