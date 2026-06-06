# Nora says English

Vocabulary matching game for Uzbek students learning English. Built with Django.

## Local development

```bash
python -m venv env
env\Scripts\activate          # Windows
# source env/bin/activate     # macOS/Linux

pip install -r requirements.txt
cp .env.example .env          # optional for local overrides

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

Open http://127.0.0.1:8000/ and http://127.0.0.1:8000/admin/

## Environment variables

Copy `.env.example` to `.env` and configure:

| Variable | Description |
|----------|-------------|
| `DJANGO_SECRET_KEY` | Required in production. Generate with `python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"` |
| `DJANGO_DEBUG` | `False` in production |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated domains |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Comma-separated `https://` origins |
| `DATABASE_URL` | Optional PostgreSQL URL |
| `DJANGO_SECURE_SSL` | `True` when served over HTTPS |
| `DJANGO_SERVE_MEDIA` | `True` to serve uploads (photos, sounds, GIFs) from the app |

## Production checklist

```bash
pip install -r requirements.txt
python manage.py migrate
python manage.py collectstatic --noinput
python manage.py createsuperuser
python manage.py check --deploy
gunicorn config.wsgi --bind 0.0.0.0:8000
```

In admin, add:

- Levels, units, and vocabulary words
- Game event assets (sounds, GIFs, messages)
- Teacher profile (About page content)

## Deploy options

### Railway / Render / similar

1. Connect the repository.
2. Set environment variables from `.env.example`.
3. Add a **persistent volume** mounted at `/app/media` (uploads must survive redeploys).
4. Build command: `pip install -r requirements.txt && python manage.py collectstatic --noinput`
5. Start command: `python manage.py migrate && gunicorn config.wsgi --bind 0.0.0.0:$PORT`
6. Set `DJANGO_SERVE_MEDIA=True` if the platform has no separate media CDN.

### Docker

```bash
docker build -t nora-says-english .
docker run -p 8000:8000 --env-file .env -v nse_media:/app/media nora-says-english
```

### VPS (nginx + gunicorn)

- Run gunicorn via systemd using the `Procfile` command.
- Point nginx at static files in `staticfiles/` and media in `media/`.
- Set `DJANGO_SERVE_MEDIA=False` and let nginx serve `/media/`.

## Project structure

```
config/          Django project settings
vocabulary/      Game app (models, views, templates, static)
staticfiles/     Collected static assets (generated)
media/           User uploads (teacher photo, game assets)
```

## Security notes

- Never commit `.env` or `db.sqlite3` with real data.
- Use PostgreSQL for production when possible (`DATABASE_URL`).
- Keep `DJANGO_DEBUG=False` on the live site.
- Change the default admin password immediately after deploy.
