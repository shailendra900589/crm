#!/bin/sh
set -e

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Ensuring platform Super Admin (Rahul)..."
python manage.py ensure_superadmin || true

# Safe: only removes GST4000/Retail placeholders — never wipes real BDM answers
echo "Scrubbing demo seed placeholders only..."
python manage.py clean_seed_form_data || true

echo "Backfilling FormSubmission + verification from lead custom_data..."
python manage.py backfill_form_submissions || true

if [ "${RUN_SEED:-0}" = "1" ]; then
  echo "Seeding demo data..."
  python manage.py seed || true
fi

exec "$@"
