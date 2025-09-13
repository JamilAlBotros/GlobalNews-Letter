from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch
from typing import List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="NLLB Translation Service", version="1.0.0")

# Model configuration
MODEL_NAME = "facebook/nllb-200-distilled-600M"
model = None
tokenizer = None

# Language code mapping for NLLB
LANG_CODES = {
    "english": "eng_Latn",
    "spanish": "spa_Latn", 
    "portuguese": "por_Latn",
    "french": "fra_Latn",
    "arabic": "ara_Arab",
    "chinese": "zho_Hans",
    "japanese": "jpn_Jpan",
}

class TranslationRequest(BaseModel):
    text: str
    source_language: str
    target_language: str

class TranslationResponse(BaseModel):
    translated_text: str
    source_language: str
    target_language: str
    confidence: Optional[float] = None

class BatchTranslationRequest(BaseModel):
    texts: List[str]
    source_language: str
    target_language: str

class BatchTranslationResponse(BaseModel):
    translations: List[TranslationResponse]

@app.on_event("startup")
async def load_model():
    global model, tokenizer
    try:
        logger.info(f"Loading NLLB model: {MODEL_NAME}")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_NAME)
        
        # Move to GPU if available
        if torch.cuda.is_available():
            model = model.cuda()
            logger.info("Model loaded on GPU")
        else:
            logger.info("Model loaded on CPU")
            
        logger.info("NLLB model loaded successfully")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        raise

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "supported_languages": list(LANG_CODES.keys())
    }

@app.get("/readyz")
async def readiness_check():
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not ready")
    return {"status": "ready"}

@app.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # Validate language codes
    source_lang = LANG_CODES.get(request.source_language.lower())
    target_lang = LANG_CODES.get(request.target_language.lower())
    
    if not source_lang:
        raise HTTPException(status_code=400, detail=f"Unsupported source language: {request.source_language}")
    if not target_lang:
        raise HTTPException(status_code=400, detail=f"Unsupported target language: {request.target_language}")
    
    try:
        # Prepare input with language codes
        input_text = f"{source_lang} {request.text}"
        inputs = tokenizer(input_text, return_tensors="pt", padding=True, truncation=True, max_length=512)
        
        if torch.cuda.is_available():
            inputs = {k: v.cuda() for k, v in inputs.items()}
        
        # Generate translation
        with torch.no_grad():
            generated_tokens = model.generate(
                **inputs,
                forced_bos_token_id=tokenizer.convert_tokens_to_ids(target_lang),
                max_length=512,
                num_beams=5,
                early_stopping=True
            )
        
        # Decode translation
        translated_text = tokenizer.decode(generated_tokens[0], skip_special_tokens=True)
        
        return TranslationResponse(
            translated_text=translated_text,
            source_language=request.source_language,
            target_language=request.target_language
        )
        
    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.post("/translate/batch", response_model=BatchTranslationResponse)
async def translate_batch(request: BatchTranslationRequest):
    if model is None or tokenizer is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    translations = []
    for text in request.texts:
        try:
            translation_request = TranslationRequest(
                text=text,
                source_language=request.source_language,
                target_language=request.target_language
            )
            result = await translate_text(translation_request)
            translations.append(result)
        except Exception as e:
            logger.error(f"Batch translation error for text '{text}': {e}")
            # Continue with other translations
            continue
    
    return BatchTranslationResponse(translations=translations)

@app.get("/languages")
async def get_supported_languages():
    return {"supported_languages": list(LANG_CODES.keys())}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)