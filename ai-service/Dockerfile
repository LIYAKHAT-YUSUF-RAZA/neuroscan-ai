# Production Dockerfile for PyTorch CPU AI Inference Microservice
FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=5001 \
    FLASK_ENV=production \
    AI_SERVICE_HOST=0.0.0.0 \
    TORCH_NUM_THREADS=2 \
    OMP_NUM_THREADS=2

WORKDIR /app

# Install runtime library dependencies (libgomp for PyTorch OpenMP support)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Security: Create non-root system user
RUN useradd -m -u 10001 -s /bin/bash appuser

# Copy application source and pre-trained model checkpoint
COPY --chown=appuser:appuser . .

USER appuser

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:5001/health || exit 1

CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "1", "--threads", "2", "--timeout", "120", "app:app"]
