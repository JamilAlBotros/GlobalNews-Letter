#!/usr/bin/env python3
"""
Run Ollama Summarization API locally using local Ollama installation
"""

import os
import sys
import uvicorn
import subprocess
import time
import signal

# Add the ollama directory to Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'ollama'))

def start_ollama_server():
    """Start Ollama server if not running"""
    try:
        # Check if Ollama is already running
        result = subprocess.run(['curl', '-s', 'http://localhost:11434/api/tags'],
                              capture_output=True, timeout=5)
        if result.returncode == 0:
            print("✅ Ollama server is already running")
            return None
    except:
        pass

    print("🚀 Starting Ollama server...")
    # Start Ollama server in background
    process = subprocess.Popen(['ollama', 'serve'],
                              stdout=subprocess.PIPE,
                              stderr=subprocess.PIPE)

    # Wait a moment for it to start
    time.sleep(3)

    # Check if it started successfully
    try:
        result = subprocess.run(['curl', '-s', 'http://localhost:11434/api/tags'],
                              capture_output=True, timeout=5)
        if result.returncode == 0:
            print("✅ Ollama server started successfully")
            return process
        else:
            print("❌ Failed to start Ollama server")
            process.terminate()
            return None
    except:
        print("❌ Failed to verify Ollama server")
        process.terminate()
        return None

def ensure_llama_model():
    """Ensure LLaMA model is available"""
    try:
        # Check available models
        result = subprocess.run(['ollama', 'list'], capture_output=True, text=True)
        if 'llama3.1:8b' in result.stdout:
            print("✅ LLaMA 3.1:8b model is available")
            return True

        print("📥 LLaMA 3.1:8b not found, pulling model...")
        # Pull the model
        result = subprocess.run(['ollama', 'pull', 'llama3.1:8b'],
                              capture_output=True, text=True, timeout=600)
        if result.returncode == 0:
            print("✅ LLaMA 3.1:8b model pulled successfully")
            return True
        else:
            print(f"❌ Failed to pull model: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Error ensuring model: {e}")
        return False

if __name__ == "__main__":
    print("🤖 Starting Ollama Summarization Service locally...")
    print(f"🔗 API will be available at: http://localhost:8001")
    print("📋 Endpoints:")
    print("   GET  /health")
    print("   GET  /readyz")
    print("   GET  /models")
    print("   POST /summarize")
    print("   POST /summarize/batch")
    print("")

    # Start Ollama server
    ollama_process = start_ollama_server()

    # Ensure model is available
    if not ensure_llama_model():
        print("❌ Cannot proceed without LLaMA model")
        if ollama_process:
            ollama_process.terminate()
        sys.exit(1)

    try:
        from app import app

        def signal_handler(sig, frame):
            print("\n👋 Stopping services...")
            if ollama_process:
                ollama_process.terminate()
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)

        uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")

    except Exception as e:
        print(f"❌ Error starting Ollama service: {e}")
        if ollama_process:
            ollama_process.terminate()