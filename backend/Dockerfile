# Production FastAPI image — uvicorn on port 8000
FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first for better layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

# Non-root user for security
RUN useradd --create-home --shell /bin/bash appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Single worker is typical behind a reverse proxy; use multiple workers via orchestration replicas
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
