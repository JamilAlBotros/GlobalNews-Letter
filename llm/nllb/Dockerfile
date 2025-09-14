# NLLB Translation Model Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies with NumPy constraint
RUN pip install --no-cache-dir \
    "numpy<2" \
    torch==2.1.0 \
    transformers==4.35.2 \
    sentencepiece==0.1.99 \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    pydantic==2.5.0 \
    httpx==0.25.2

# Copy application files
COPY app.py /app/
COPY requirements.txt /app/

# Create cache directory and non-root user
RUN mkdir -p /app/cache && \
    useradd -m -u 1000 modeluser && \
    chown -R modeluser:modeluser /app && \
    chmod -R 755 /app/cache

USER modeluser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]