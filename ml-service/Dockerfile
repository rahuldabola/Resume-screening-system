FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Shell form on purpose: a platform that assigns the port at runtime (Railway,
# Cloud Run, Heroku) sets $PORT, and the exec form would pass it uninterpolated.
# HOST is configurable for the same reason: Railway's private network is
# IPv6-only, so a service only its sibling services call has to bind "::".
CMD uvicorn app.main:app --host ${HOST:-0.0.0.0} --port ${PORT:-8000}
