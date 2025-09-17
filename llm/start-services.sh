#!/bin/bash

# LLM Services Startup Script
echo "🚀 Starting LLM Services..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first:"
    echo "   sudo systemctl start docker"
    echo "   # or start Docker Desktop if you're using it"
    exit 1
fi

# Navigate to LLM directory
cd "$(dirname "$0")"

echo "📁 Working directory: $(pwd)"

# Create network if it doesn't exist
echo "🔗 Creating network..."
docker network create globalnews_network 2>/dev/null || echo "Network already exists"

# Start services
echo "🐳 Starting LLM services..."
docker compose -f docker-compose.llm.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service status
echo "📊 Service status:"
docker compose -f docker-compose.llm.yml ps

echo ""
echo "✅ Services started! You can now test them with:"
echo "   python3 test_llm_api.py"
echo ""
echo "📋 Service endpoints:"
echo "   NLLB Translation: http://localhost:8000"
echo "   Ollama Summarization: http://localhost:8001"
echo ""
echo "🔍 To check logs:"
echo "   docker compose -f docker-compose.llm.yml logs nllb-service"
echo "   docker compose -f docker-compose.llm.yml logs ollama-service"