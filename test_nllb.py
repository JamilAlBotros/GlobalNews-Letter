#!/usr/bin/env python3
"""
Simple test script for NLLB translation service
"""
import requests
import json
import time

def test_nllb_service():
    """Test NLLB translation service"""
    base_url = "http://localhost:8000"
    
    print("Testing NLLB Translation Service...")
    
    # Test health endpoint
    try:
        print("1. Testing health endpoint...")
        response = requests.get(f"{base_url}/health", timeout=10)
        print(f"   Health Status: {response.status_code}")
        if response.status_code == 200:
            health_data = response.json()
            print(f"   Health Data: {health_data}")
        else:
            print(f"   Health check failed: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"   Health check failed: {e}")
        return False
    
    # Wait a moment for service to be ready
    time.sleep(2)
    
    # Test readiness endpoint
    try:
        print("2. Testing readiness endpoint...")
        response = requests.get(f"{base_url}/readyz", timeout=10)
        print(f"   Readiness Status: {response.status_code}")
        if response.status_code != 200:
            print(f"   Service not ready: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"   Readiness check failed: {e}")
        return False
    
    # Test supported languages
    try:
        print("3. Testing supported languages endpoint...")
        response = requests.get(f"{base_url}/languages", timeout=10)
        print(f"   Languages Status: {response.status_code}")
        if response.status_code == 200:
            languages = response.json()
            print(f"   Supported Languages: {languages}")
        else:
            print(f"   Languages check failed: {response.text}")
    except requests.exceptions.RequestException as e:
        print(f"   Languages check failed: {e}")
    
    # Test translation
    try:
        print("4. Testing translation functionality...")
        translation_request = {
            "text": "Hello world, this is a test",
            "source_language": "english",
            "target_language": "spanish"
        }
        
        response = requests.post(
            f"{base_url}/translate",
            json=translation_request,
            timeout=30
        )
        
        print(f"   Translation Status: {response.status_code}")
        if response.status_code == 200:
            translation_data = response.json()
            print(f"   Original: {translation_request['text']}")
            print(f"   Translated: {translation_data['translated_text']}")
            print(f"   Translation successful!")
            return True
        else:
            print(f"   Translation failed: {response.text}")
            return False
            
    except requests.exceptions.RequestException as e:
        print(f"   Translation test failed: {e}")
        return False

if __name__ == "__main__":
    success = test_nllb_service()
    if success:
        print("\n✅ NLLB service is working correctly!")
    else:
        print("\n❌ NLLB service test failed!")
        exit(1)