# Ollama 3.1 8B Summarization Service Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.ai/install.sh | sh

# Install Python dependencies
RUN pip install --no-cache-dir \
    fastapi==0.104.1 \
    uvicorn==0.24.0 \
    pydantic==2.5.0 \
    httpx==0.25.2 \
    requests==2.31.0

# Copy application files
COPY app.py /app/
COPY requirements.txt /app/
COPY start.sh /app/

# Make start script executable
RUN chmod +x /app/start.sh

# Create non-root user
RUN useradd -m -u 1000 modeluser && \
    chown -R modeluser:modeluser /app

# Create ollama data directory
RUN mkdir -p /home/modeluser/.ollama && \
    chown -R modeluser:modeluser /home/modeluser/.ollama

USER modeluser

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=120s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8001/health')" || exit 1

EXPOSE 8001 11434

CMD ["/app/start.sh"]