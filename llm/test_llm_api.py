#!/usr/bin/env python3
"""
Test script for LLM API services (NLLB Translation + Ollama Summarization)
Run this script to test both services when they're running.
"""

import requests
import json
import time
from typing import Dict, Any

# Service URLs
NLLB_BASE_URL = "http://localhost:8000"
OLLAMA_BASE_URL = "http://localhost:8001"

def test_service_health(service_name: str, base_url: str) -> bool:
    """Test if a service is healthy"""
    try:
        response = requests.get(f"{base_url}/health", timeout=10)
        if response.status_code == 200:
            print(f"✅ {service_name} is healthy: {response.json()}")
            return True
        else:
            print(f"❌ {service_name} health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ {service_name} is not accessible: {e}")
        return False

def test_nllb_translation():
    """Test NLLB translation service"""
    print("\n🌐 Testing NLLB Translation Service...")

    # Test single translation
    translation_data = {
        "text": "Hello, how are you today?",
        "source_language": "english",
        "target_language": "spanish"
    }

    try:
        response = requests.post(
            f"{NLLB_BASE_URL}/translate",
            json=translation_data,
            timeout=30
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Translation successful:")
            print(f"   Original: {translation_data['text']}")
            print(f"   Translated: {result['translated_text']}")
            print(f"   {translation_data['source_language']} → {translation_data['target_language']}")
        else:
            print(f"❌ Translation failed: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Translation request failed: {e}")

def test_nllb_batch_translation():
    """Test NLLB batch translation"""
    print("\n📦 Testing NLLB Batch Translation...")

    batch_data = {
        "texts": [
            "Good morning!",
            "How are you?",
            "Have a great day!"
        ],
        "source_language": "english",
        "target_language": "french"
    }

    try:
        response = requests.post(
            f"{NLLB_BASE_URL}/translate/batch",
            json=batch_data,
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Batch translation successful:")
            for i, translation in enumerate(result['translations']):
                print(f"   {i+1}. {batch_data['texts'][i]} → {translation['translated_text']}")
        else:
            print(f"❌ Batch translation failed: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Batch translation request failed: {e}")

def test_ollama_summarization():
    """Test Ollama summarization service"""
    print("\n📝 Testing Ollama Summarization Service...")

    # Long text for summarization
    long_text = """
    Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to
    natural intelligence displayed by animals including humans. Leading AI textbooks define
    the field as the study of "intelligent agents": any system that perceives its environment
    and takes actions that maximize its chance of achieving its goals. Some popular accounts
    use the term "artificial intelligence" to describe machines that mimic "cognitive" functions
    that humans associate with the human mind, such as "learning" and "problem solving".

    The traditional goals of AI research include reasoning, knowledge representation, planning,
    learning, natural language processing, perception, and the ability to move and manipulate
    objects. General intelligence—the ability to solve an arbitrary problem—is among the
    field's long-term goals. To solve these problems, AI researchers have adapted and integrated
    a wide range of problem-solving techniques—including search and mathematical optimization,
    formal logic, artificial neural networks, and methods based on statistics, probability,
    and economics.
    """

    summarization_data = {
        "text": long_text.strip(),
        "max_length": 100,
        "language": "english"
    }

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/summarize",
            json=summarization_data,
            timeout=120  # Longer timeout for LLM
        )

        if response.status_code == 200:
            result = response.json()
            print(f"✅ Summarization successful:")
            print(f"   Original length: {result['original_length']} words")
            print(f"   Summary length: {result['summary_length']} words")
            print(f"   Compression ratio: {result['compression_ratio']:.2f}")
            print(f"   Summary: {result['summary']}")
        else:
            print(f"❌ Summarization failed: {response.status_code} - {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Summarization request failed: {e}")

def test_supported_languages():
    """Test getting supported languages"""
    print("\n🌍 Testing Supported Languages...")

    try:
        response = requests.get(f"{NLLB_BASE_URL}/languages", timeout=10)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Supported languages: {', '.join(result['supported_languages'])}")
        else:
            print(f"❌ Failed to get languages: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Languages request failed: {e}")

def test_ollama_models():
    """Test getting available Ollama models"""
    print("\n🤖 Testing Available Ollama Models...")

    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/models", timeout=10)
        if response.status_code == 200:
            result = response.json()
            if 'models' in result:
                print(f"✅ Available models:")
                for model in result['models']:
                    print(f"   - {model.get('name', 'Unknown')}")
            else:
                print(f"✅ Models response: {result}")
        else:
            print(f"❌ Failed to get models: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Models request failed: {e}")

def main():
    """Main test function"""
    print("🧪 LLM API Test Suite")
    print("=" * 50)

    # Test service health
    nllb_healthy = test_service_health("NLLB Translation", NLLB_BASE_URL)
    ollama_healthy = test_service_health("Ollama Summarization", OLLAMA_BASE_URL)

    if not nllb_healthy and not ollama_healthy:
        print("\n❌ Both services are down. Start them with:")
        print("   cd /path/to/llm && docker compose -f docker-compose.llm.yml up -d")
        return

    # Test NLLB if healthy
    if nllb_healthy:
        test_supported_languages()
        test_nllb_translation()
        test_nllb_batch_translation()

    # Test Ollama if healthy
    if ollama_healthy:
        test_ollama_models()
        test_ollama_summarization()

    print("\n✅ Test suite completed!")

if __name__ == "__main__":
    main()