@echo off
REM GlobalNewsLetter Production Deployment Script for Windows
setlocal

echo 🚀 Starting production deployment...

REM Check if required files exist
if not exist ".env.prod" (
    echo ❌ Error: .env.prod file not found!
    echo Copy .env.prod.example to .env.prod and fill in your values.
    exit /b 1
)

REM Build production images
echo 🔨 Building production images...
docker-compose -f docker-compose.prod.yml build --no-cache
if errorlevel 1 (
    echo ❌ Build failed
    exit /b 1
)

REM Stop existing containers if running
echo 🛑 Stopping existing containers...
docker-compose -f docker-compose.prod.yml down

REM Start production services
echo 🚀 Starting production services...
docker-compose -f docker-compose.prod.yml up -d
if errorlevel 1 (
    echo ❌ Failed to start services
    exit /b 1
)

REM Wait for services to be ready
echo ⏳ Waiting for services to start...
timeout /t 30 /nobreak > nul

REM Check service health
echo 🔍 Checking service health...
docker-compose -f docker-compose.prod.yml ps

REM Check API health endpoint
echo 🏥 Testing API health...
curl -f http://localhost:3333/healthz > nul 2>&1
if errorlevel 1 (
    echo ❌ API health check failed
    echo 📋 API logs:
    docker-compose -f docker-compose.prod.yml logs api --tail=20
    exit /b 1
) else (
    echo ✅ API is healthy
)

REM Check frontend
echo 🌐 Testing frontend...
curl -f http://localhost:3000 > nul 2>&1
if errorlevel 1 (
    echo ❌ Frontend is not accessible
    echo 📋 Frontend logs:
    docker-compose -f docker-compose.prod.yml logs frontend --tail=20
    exit /b 1
) else (
    echo ✅ Frontend is accessible
)

echo.
echo 🎉 Production deployment completed successfully!
echo 📋 Service URLs:
echo    Frontend: http://localhost:3000
echo    API: http://localhost:3333
echo    Newsletter: http://localhost:3000/newsletter
echo.
echo 📝 To view logs: docker-compose -f docker-compose.prod.yml logs -f
echo 📝 To stop: docker-compose -f docker-compose.prod.yml down

pause