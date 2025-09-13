#!/bin/bash

# Start Ollama service in the background
echo "Starting Ollama service..."
ollama serve &

# Wait for Ollama to be ready
echo "Waiting for Ollama to start..."
sleep 10

# Start the FastAPI application
echo "Starting FastAPI summarization service..."
exec uvicorn app:app --host 0.0.0.0 --port 8001