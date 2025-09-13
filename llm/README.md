# LLM Services for GlobalNews Letter

This directory contains Docker configurations for AI translation and summarization services using NLLB and Ollama 3.1 8B models.

## Services

### NLLB Translation Service (Port 8000)
- **Model**: facebook/nllb-200-distilled-600M
- **Purpose**: Multi-language translation for news articles
- **Supported Languages**: English, Spanish, Portuguese, French, Arabic, Chinese, Japanese
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /readyz` - Readiness check  
  - `POST /translate` - Single text translation
  - `POST /translate/batch` - Batch translation
  - `GET /languages` - Supported languages

### Ollama Summarization Service (Port 8001)
- **Model**: llama3.1:8b
- **Purpose**: Article summarization and content processing
- **Endpoints**:
  - `GET /health` - Health check
  - `GET /readyz` - Readiness check
  - `POST /summarize` - Single text summarization
  - `POST /summarize/batch` - Batch summarization
  - `GET /models` - Available models

## Quick Start

### Start LLM Services Only
```bash
# From project root
cd llm
docker-compose -f docker-compose.llm.yml up -d

# Check logs
docker-compose -f docker-compose.llm.yml logs -f
```

### Start with Main Application
```bash
# From project root
docker-compose up -d
```

## API Usage Examples

### Translation Service

```bash
# Health check
curl http://localhost:8000/health

# Translate text
curl -X POST http://localhost:8000/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello world, this is a news article",
    "source_language": "english", 
    "target_language": "spanish"
  }'

# Batch translation
curl -X POST http://localhost:8000/translate/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["First article", "Second article"],
    "source_language": "english",
    "target_language": "french" 
  }'
```

### Summarization Service

```bash
# Health check
curl http://localhost:8001/health

# Summarize text
curl -X POST http://localhost:8001/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Long news article content here...",
    "max_length": 100,
    "language": "english"
  }'

# Batch summarization
curl -X POST http://localhost:8001/summarize/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": ["Long article 1...", "Long article 2..."],
    "max_length": 150,
    "language": "english"
  }'
```

## Resource Requirements

### Minimum System Requirements
- **RAM**: 6GB available (4GB for Ollama, 2GB for NLLB)
- **Storage**: 10GB for models and cache
- **CPU**: Multi-core recommended for acceptable performance

### GPU Support (Optional)
- NVIDIA GPU with CUDA support will significantly improve performance
- Modify Dockerfiles to include CUDA base images for GPU acceleration

## Model Download Times

**First Run:**
- NLLB model (~600MB): 2-5 minutes
- Ollama 3.1 8B model (~4.7GB): 10-20 minutes depending on internet speed

Models are cached in Docker volumes for subsequent starts.

## Environment Variables

### NLLB Service
- `HF_HOME`: Hugging Face cache directory
- `TRANSFORMERS_CACHE`: Transformers model cache

### Ollama Service  
- `OLLAMA_HOST`: Host binding (0.0.0.0 for container access)
- `OLLAMA_ORIGINS`: CORS origins (* for development)

## Troubleshooting

### Service Not Starting
```bash
# Check service logs
docker-compose logs nllb-service
docker-compose logs ollama-service

# Check resource usage
docker stats
```

### Model Download Issues
```bash
# Check available disk space
df -h

# Clear Docker cache if needed
docker system prune -a
```

### Performance Issues
- Ensure adequate RAM allocation
- Consider GPU support for production workloads
- Monitor container resource limits

## Integration with Main Application

The main API service automatically connects to these LLM services:
- Translation service: `http://nllb-service:8000`
- Summarization service: `http://ollama-service:8001`

Environment variables in main docker-compose.yml:
- `TRANSLATION_SERVICE_URL=http://nllb-service:8000`
- `LLM_BASE_URL=http://ollama-service:8001`