# cPanel Deployment

## Activate virtual environment

```bash
source /home/norasays/virtualenv/nse/norasaysenglish/3.13/bin/activate
```

## Install dependencies

```bash
pip install -r requirements.txt
```

## Run migrations

```bash
python manage.py migrate
```

## Collect static files

```bash
python manage.py collectstatic --noinput
```

## Restart Passenger

```bash
touch ~/nse/norasaysenglish/tmp/restart.txt
```

## Create media symlink (required)

```bash
ln -s /home/norasays/nse/norasaysenglish/media ~/public_html/media
```