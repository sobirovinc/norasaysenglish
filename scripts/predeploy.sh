#!/usr/bin/env bash
set -euo pipefail

python manage.py check --deploy
python manage.py migrate --noinput
python manage.py collectstatic --noinput

echo "Pre-deploy checks passed."
