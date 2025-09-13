from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx
import asyncio
import logging
from typing import List, Optional
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Ollama Summarization Service", version="1.0.0")

# Ollama configuration
OLLAMA_BASE_URL = "http://localhost:11434"
MODEL_NAME = "llama3.1:8b"

class SummarizationRequest(BaseModel):
    text: str
    max_length: Optional[int] = 150
    language: Optional[str] = "english"

class SummarizationResponse(BaseModel):
    summary: str
    original_length: int
    summary_length: int
    compression_ratio: float
    language: str

class BatchSummarizationRequest(BaseModel):
    texts: List[str]
    max_length: Optional[int] = 150
    language: Optional[str] = "english"

class BatchSummarizationResponse(BaseModel):
    summaries: List[SummarizationResponse]

async def check_ollama_health():
    """Check if Ollama service is running"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            return response.status_code == 200
    except Exception:
        return False

async def ensure_model_exists():
    """Ensure the required model is available"""
    try:
        async with httpx.AsyncClient() as client:
            # Check if model exists
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                model_names = [model["name"] for model in models]
                
                if MODEL_NAME not in model_names:
                    logger.info(f"Pulling model: {MODEL_NAME}")
                    # Pull the model
                    pull_response = await client.post(
                        f"{OLLAMA_BASE_URL}/api/pull",
                        json={"name": MODEL_NAME},
                        timeout=600.0  # 10 minutes timeout for model download
                    )
                    if pull_response.status_code == 200:
                        logger.info(f"Model {MODEL_NAME} pulled successfully")
                        return True
                    else:
                        logger.error(f"Failed to pull model: {pull_response.text}")
                        return False
                else:
                    logger.info(f"Model {MODEL_NAME} already available")
                    return True
            return False
    except Exception as e:
        logger.error(f"Error ensuring model exists: {e}")
        return False

async def generate_summary(text: str, max_length: int = 150, language: str = "english") -> str:
    """Generate summary using Ollama"""
    prompt = f"""Please provide a concise summary of the following text in {language}. 
    The summary should be approximately {max_length} words or less and capture the main points:

    Text: {text}

    Summary:"""
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "top_p": 0.9,
                        "max_tokens": max_length * 2  # Allow some buffer
                    }
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return result.get("response", "").strip()
            else:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Summarization failed")
                
    except httpx.TimeoutException:
        logger.error("Ollama API timeout")
        raise HTTPException(status_code=504, detail="Summarization timeout")
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.on_event("startup")
async def startup_event():
    """Initialize the service"""
    logger.info("Starting Ollama Summarization Service")
    
    # Wait for Ollama to be ready
    max_retries = 30
    for i in range(max_retries):
        if await check_ollama_health():
            logger.info("Ollama service is ready")
            break
        logger.info(f"Waiting for Ollama service... ({i+1}/{max_retries})")
        await asyncio.sleep(5)
    else:
        logger.error("Ollama service failed to start")
        return
    
    # Ensure model is available
    if await ensure_model_exists():
        logger.info("Model is ready")
    else:
        logger.error("Failed to ensure model availability")

@app.get("/health")
async def health_check():
    ollama_ready = await check_ollama_health()
    return {
        "status": "healthy" if ollama_ready else "unhealthy",
        "ollama_ready": ollama_ready,
        "model": MODEL_NAME
    }

@app.get("/readyz")
async def readiness_check():
    if not await check_ollama_health():
        raise HTTPException(status_code=503, detail="Ollama service not ready")
    return {"status": "ready"}

@app.post("/summarize", response_model=SummarizationResponse)
async def summarize_text(request: SummarizationRequest):
    if not await check_ollama_health():
        raise HTTPException(status_code=503, detail="Ollama service not available")
    
    try:
        summary = await generate_summary(
            request.text, 
            request.max_length or 150,
            request.language or "english"
        )
        
        original_length = len(request.text.split())
        summary_length = len(summary.split())
        compression_ratio = summary_length / original_length if original_length > 0 else 0
        
        return SummarizationResponse(
            summary=summary,
            original_length=original_length,
            summary_length=summary_length,
            compression_ratio=compression_ratio,
            language=request.language or "english"
        )
        
    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/summarize/batch", response_model=BatchSummarizationResponse)
async def summarize_batch(request: BatchSummarizationRequest):
    if not await check_ollama_health():
        raise HTTPException(status_code=503, detail="Ollama service not available")
    
    summaries = []
    for text in request.texts:
        try:
            summarization_request = SummarizationRequest(
                text=text,
                max_length=request.max_length,
                language=request.language
            )
            result = await summarize_text(summarization_request)
            summaries.append(result)
        except Exception as e:
            logger.error(f"Batch summarization error for text: {e}")
            continue
    
    return BatchSummarizationResponse(summaries=summaries)

@app.get("/models")
async def get_available_models():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
            if response.status_code == 200:
                return response.json()
            else:
                raise HTTPException(status_code=500, detail="Failed to get models")
    except Exception as e:
        logger.error(f"Error getting models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)