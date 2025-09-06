#!/bin/bash

# GlobalNewsLetter Production Deployment Script
set -e

echo "🚀 Starting production deployment..."

# Check if required files exist
if [ ! -f ".env.prod" ]; then
    echo "❌ Error: .env.prod file not found!"
    echo "Copy .env.prod.example to .env.prod and fill in your values."
    exit 1
fi

# Build production images
echo "🔨 Building production images..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop existing containers if running
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down

# Start production services
echo "🚀 Starting production services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check service health
echo "🔍 Checking service health..."
docker-compose -f docker-compose.prod.yml ps

# Check API health endpoint
echo "🏥 Testing API health..."
if curl -f http://localhost:3333/healthz > /dev/null 2>&1; then
    echo "✅ API is healthy"
else
    echo "❌ API health check failed"
    echo "📋 API logs:"
    docker-compose -f docker-compose.prod.yml logs api --tail=20
    exit 1
fi

# Check frontend
echo "🌐 Testing frontend..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Frontend is accessible"
else
    echo "❌ Frontend is not accessible"
    echo "📋 Frontend logs:"
    docker-compose -f docker-compose.prod.yml logs frontend --tail=20
    exit 1
fi

echo ""
echo "🎉 Production deployment completed successfully!"
echo "📋 Service URLs:"
echo "   Frontend: http://localhost:3000"
echo "   API: http://localhost:3333"
echo "   Newsletter: http://localhost:3000/newsletter"
echo ""
echo "📝 To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "📝 To stop: docker-compose -f docker-compose.prod.yml down"