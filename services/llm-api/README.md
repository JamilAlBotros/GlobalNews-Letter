# GlobalNews LLM API

FastAPI service providing translation and summarization capabilities using NLLB and LLaMA models.

## Features

- **Translation**: NLLB-200 model for multilingual translation
- **Summarization**: LLaMA-3-8B model for text summarization
- **Batch Processing**: Handle multiple texts at once
- **GPU Support**: CUDA acceleration when available
- **Health Monitoring**: Built-in health checks

## API Endpoints

### Core Endpoints

- `GET /` - Service status
- `GET /health` - Detailed health check

### Translation

- `POST /translate` - Translate single text
- `POST /translate/batch` - Translate multiple texts

### Summarization

- `POST /summarize` - Summarize text with style options

### Combined

- `POST /translate-summarize` - Translate then summarize

## Model Requirements

Before running, ensure you have the following models in the `./models/` directory:

```
./models/
├── nllb-200/          # NLLB translation model
│   ├── config.json
│   ├── pytorch_model.bin
│   └── tokenizer.json
└── llama-3-8b/        # LLaMA summarization model
    ├── config.json
    ├── pytorch_model.bin
    └── tokenizer.json
```

## Usage Examples

### Translation

```bash
curl -X POST "http://localhost:8000/translate" \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Hello, how are you?",
       "source_language": "en",
       "target_language": "es"
     }'
```

### Summarization

```bash
curl -X POST "http://localhost:8000/summarize" \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Long news article text here...",
       "style": "concise",
       "max_length": 100
     }'
```

### Batch Translation

```bash
curl -X POST "http://localhost:8000/translate/batch" \
     -H "Content-Type: application/json" \
     -d '{
       "texts": ["Hello world", "Good morning", "Thank you"],
       "source_language": "en",
       "target_language": "fr"
     }'
```

## Supported Languages

The service supports the following language codes:

- `en` - English
- `es` - Spanish
- `pt` - Portuguese
- `fr` - French
- `ar` - Arabic
- `zh` - Chinese
- `ja` - Japanese
- `de` - German
- `it` - Italian
- `ru` - Russian

## Docker Setup

The service is configured to run with Docker Compose. GPU support is available when NVIDIA Docker runtime is installed.

### Environment Variables

- `PYTHONPATH` - Python module path
- `TOKENIZERS_PARALLELISM` - Disable tokenizer parallelism warnings
- `TRANSFORMERS_CACHE` - Hugging Face cache directory

### Volume Mounts

- `./models:/app/models:ro` - Mount local models directory (read-only)

## Performance Notes

- **First Request**: May take longer as models need to load into memory
- **GPU Memory**: Ensure sufficient VRAM for both models (recommended: 12GB+)
- **CPU Fallback**: Service works on CPU but will be significantly slower
- **Batch Processing**: More efficient for multiple translations

## Health Monitoring

The service provides health checks at `/health` which report:

- Model loading status
- GPU availability
- Memory usage
- Service uptime

## Integration with GlobalNews-Letter

The LLM API integrates with the main newsletter application by providing:

1. Article translation for multilingual newsletters
2. Article summarization for newsletter content
3. Combined translation and summarization workflows

The main API service connects to this LLM service via the configured endpoints in the docker-compose environment variables.