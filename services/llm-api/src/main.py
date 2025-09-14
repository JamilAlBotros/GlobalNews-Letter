"""
FastAPI service for NLLB translation and LLaMA summarization models.
Provides endpoints for the GlobalNews-Letter application.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, AutoModelForCausalLM
import torch
import logging
import asyncio
from typing import Optional, List
import uvicorn

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="GlobalNews LLM API",
    description="Translation and Summarization API for GlobalNews-Letter",
    version="1.0.0"
)

# Global model storage
models = {
    "nllb_tokenizer": None,
    "nllb_model": None,
    "llama_tokenizer": None,
    "llama_model": None
}

# Language code mappings for NLLB
LANGUAGE_CODES = {
    "en": "eng_Latn",
    "es": "spa_Latn",
    "pt": "por_Latn",
    "fr": "fra_Latn",
    "ar": "arb_Arab",
    "zh": "zho_Hans",
    "ja": "jpn_Jpan",
    "de": "deu_Latn",
    "it": "ita_Latn",
    "ru": "rus_Cyrl"
}

class TranslationRequest(BaseModel):
    text: str = Field(..., description="Text to translate")
    source_language: str = Field(default="auto", description="Source language code (auto-detect if not specified)")
    target_language: str = Field(default="en", description="Target language code")

class SummarizationRequest(BaseModel):
    text: str = Field(..., description="Text to summarize")
    style: str = Field(default="concise", description="Summarization style: concise, detailed, bullet")
    max_length: Optional[int] = Field(default=150, description="Maximum length of summary")

class BatchTranslationRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to translate")
    source_language: str = Field(default="auto", description="Source language code")
    target_language: str = Field(default="en", description="Target language code")

class TranslationResponse(BaseModel):
    translated_text: str
    source_language: str
    target_language: str
    original_text: str

class SummarizationResponse(BaseModel):
    summary: str
    original_text: str
    style: str

class BatchTranslationResponse(BaseModel):
    translations: List[TranslationResponse]
    batch_size: int

@app.on_event("startup")
async def load_models():
    """Load models on application startup"""
    try:
        logger.info("Loading NLLB translation model...")
        nllb_model_path = "./models/nllb-200"
        models["nllb_tokenizer"] = AutoTokenizer.from_pretrained(nllb_model_path)
        models["nllb_model"] = AutoModelForSeq2SeqLM.from_pretrained(nllb_model_path)

        # Move to GPU if available
        if torch.cuda.is_available():
            models["nllb_model"] = models["nllb_model"].to("cuda")
            logger.info("NLLB model loaded on GPU")
        else:
            logger.info("NLLB model loaded on CPU")

        logger.info("Loading LLaMA summarization model...")
        llama_model_path = "./models/llama-3-8b"
        models["llama_tokenizer"] = AutoTokenizer.from_pretrained(llama_model_path)
        models["llama_model"] = AutoModelForCausalLM.from_pretrained(
            llama_model_path,
            device_map="auto",
            torch_dtype="auto"
        )

        # Set pad token if not exists
        if models["llama_tokenizer"].pad_token is None:
            models["llama_tokenizer"].pad_token = models["llama_tokenizer"].eos_token

        logger.info("All models loaded successfully")

    except Exception as e:
        logger.error(f"Error loading models: {e}")
        raise

def get_language_code(lang: str) -> str:
    """Convert language code to NLLB format"""
    return LANGUAGE_CODES.get(lang.lower(), "eng_Latn")

def detect_language(text: str) -> str:
    """Simple language detection based on text characteristics"""
    # This is a simplified approach - in production you'd use a proper language detection library
    # For now, assume English if not specified
    return "en"

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "GlobalNews LLM API",
        "status": "healthy",
        "models_loaded": all(model is not None for model in models.values())
    }

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "models": {
            "nllb": models["nllb_model"] is not None,
            "llama": models["llama_model"] is not None
        },
        "gpu_available": torch.cuda.is_available(),
        "gpu_count": torch.cuda.device_count() if torch.cuda.is_available() else 0
    }

@app.post("/translate", response_model=TranslationResponse)
async def translate_text(request: TranslationRequest):
    """Translate text using NLLB model"""
    try:
        if not models["nllb_model"] or not models["nllb_tokenizer"]:
            raise HTTPException(status_code=503, detail="NLLB model not loaded")

        # Auto-detect source language if needed
        source_lang = request.source_language
        if source_lang == "auto":
            source_lang = detect_language(request.text)

        # Get language codes
        source_code = get_language_code(source_lang)
        target_code = get_language_code(request.target_language)

        # Tokenize input
        inputs = models["nllb_tokenizer"](
            request.text,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=512
        )

        # Move to same device as model
        device = next(models["nllb_model"].parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}

        # Generate translation
        with torch.no_grad():
            outputs = models["nllb_model"].generate(
                **inputs,
                forced_bos_token_id=models["nllb_tokenizer"].lang_code_to_id[target_code],
                max_new_tokens=512,
                num_beams=4,
                early_stopping=True
            )

        # Decode output
        translated_text = models["nllb_tokenizer"].decode(outputs[0], skip_special_tokens=True)

        return TranslationResponse(
            translated_text=translated_text,
            source_language=source_lang,
            target_language=request.target_language,
            original_text=request.text
        )

    except Exception as e:
        logger.error(f"Translation error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@app.post("/translate/batch", response_model=BatchTranslationResponse)
async def translate_batch(request: BatchTranslationRequest):
    """Translate multiple texts in batch"""
    try:
        translations = []

        for text in request.texts:
            translation_request = TranslationRequest(
                text=text,
                source_language=request.source_language,
                target_language=request.target_language
            )
            translation = await translate_text(translation_request)
            translations.append(translation)

        return BatchTranslationResponse(
            translations=translations,
            batch_size=len(request.texts)
        )

    except Exception as e:
        logger.error(f"Batch translation error: {e}")
        raise HTTPException(status_code=500, detail=f"Batch translation failed: {str(e)}")

@app.post("/summarize", response_model=SummarizationResponse)
async def summarize_text(request: SummarizationRequest):
    """Summarize text using LLaMA model"""
    try:
        if not models["llama_model"] or not models["llama_tokenizer"]:
            raise HTTPException(status_code=503, detail="LLaMA model not loaded")

        # Create prompt based on style
        if request.style == "concise":
            prompt = f"Summarize this news article in 2-3 concise sentences:\n\n{request.text}\n\nSummary:"
        elif request.style == "detailed":
            prompt = f"Provide a detailed summary of this news article:\n\n{request.text}\n\nDetailed Summary:"
        elif request.style == "bullet":
            prompt = f"Summarize this news article in bullet points:\n\n{request.text}\n\nKey Points:\n•"
        else:
            prompt = f"Summarize this text:\n\n{request.text}\n\nSummary:"

        # Tokenize input
        inputs = models["llama_tokenizer"](
            prompt,
            return_tensors="pt",
            padding=True,
            truncation=True,
            max_length=2048
        )

        # Move to same device as model
        device = next(models["llama_model"].parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}

        # Generate summary
        with torch.no_grad():
            outputs = models["llama_model"].generate(
                **inputs,
                max_new_tokens=request.max_length or 150,
                do_sample=True,
                temperature=0.7,
                pad_token_id=models["llama_tokenizer"].eos_token_id,
                eos_token_id=models["llama_tokenizer"].eos_token_id,
                early_stopping=True
            )

        # Decode output and extract only the new tokens (summary)
        full_output = models["llama_tokenizer"].decode(outputs[0], skip_special_tokens=True)
        summary = full_output[len(prompt):].strip()

        return SummarizationResponse(
            summary=summary,
            original_text=request.text,
            style=request.style
        )

    except Exception as e:
        logger.error(f"Summarization error: {e}")
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/translate-summarize")
async def translate_and_summarize(
    text: str,
    source_language: str = "auto",
    target_language: str = "en",
    summary_style: str = "concise"
):
    """Translate text and then summarize it"""
    try:
        # First translate
        translation_request = TranslationRequest(
            text=text,
            source_language=source_language,
            target_language=target_language
        )
        translation = await translate_text(translation_request)

        # Then summarize the translated text
        summary_request = SummarizationRequest(
            text=translation.translated_text,
            style=summary_style
        )
        summary = await summarize_text(summary_request)

        return {
            "original_text": text,
            "translated_text": translation.translated_text,
            "summary": summary.summary,
            "source_language": translation.source_language,
            "target_language": translation.target_language,
            "summary_style": summary_style
        }

    except Exception as e:
        logger.error(f"Translate-summarize error: {e}")
        raise HTTPException(status_code=500, detail=f"Translate-summarize failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)