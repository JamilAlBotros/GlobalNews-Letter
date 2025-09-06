# Production Deployment Guide

## 📋 Prerequisites

- Docker and Docker Compose installed
- Domain name (optional, can use localhost)
- SSL certificates (for HTTPS)
- Environment variables configured

## 🚀 Quick Start

### 1. Configure Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` with your production values:
- `POSTGRES_PASSWORD`: Secure PostgreSQL password
- `JWT_SECRET`: Secure JWT secret (minimum 32 characters)
- `API_KEY`: Secure API key for authentication
- `NEXT_PUBLIC_API_URL`: Your domain's API URL
- `CORS_ORIGINS`: Allowed frontend domains
- `LLM_PROVIDER`: Your LLM provider (openai, anthropic, ollama)
- `LLM_MODEL`: Your chosen model

### 2. Deploy

**Windows:**
```cmd
deploy-prod.bat
```

**Linux/Mac:**
```bash
chmod +x deploy-prod.sh
./deploy-prod.sh
```

**Manual:**
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

## 🏗️ Architecture

### Services

1. **Frontend** (Port 3000)
   - Next.js application with newsletter curation page
   - Includes new preview and translation features
   - Optimized production build

2. **API** (Port 3333) 
   - Fastify backend with RSS polling
   - Newsletter generation and curation
   - PostgreSQL database integration

3. **Database** (PostgreSQL 15)
   - Persistent data storage
   - Automatic backups
   - Health monitoring

4. **Nginx** (Ports 80/443)
   - Reverse proxy and load balancing
   - SSL termination
   - Static file serving

### New Newsletter Features in Production

✅ **Newsletter Curation Page** (`/newsletter`)
- Article selection with real-time preview
- Copy to clipboard functionality
- Description extraction for translations
- Two-panel responsive layout
- Production-optimized performance

✅ **Enhanced Features**
- Real-time article preview
- Translation preparation tools
- Bulk article selection
- Newsletter formatting controls
- Copy functionality with fallback support

## 🔒 Security

### Environment Security
- All secrets stored in `.env.prod`
- JWT tokens with secure signing
- CORS configured for specific domains
- Rate limiting enabled
- Production logging levels

### Database Security
- PostgreSQL with authentication
- Connection pooling
- Backup strategies
- Health monitoring

## 📊 Monitoring

### Health Checks
- API: `http://your-domain:3333/healthz`
- Frontend: `http://your-domain:3000`
- Database: Internal health checks

### Logs
```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f frontend
```

## 🛠️ Management Commands

### Start Services
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Stop Services
```bash
docker-compose -f docker-compose.prod.yml down
```

### Rebuild and Deploy
```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Database Backup
```bash
docker-compose -f docker-compose.prod.yml exec db pg_dump -U globalnews globalnews > backup.sql
```

### Database Restore
```bash
docker-compose -f docker-compose.prod.yml exec -T db psql -U globalnews globalnews < backup.sql
```

## 🔧 Configuration

### Scaling
To increase performance, update `docker-compose.prod.yml`:

```yaml
api:
  deploy:
    replicas: 3
  
frontend:
  deploy:
    replicas: 2
```

### Resource Limits
```yaml
api:
  deploy:
    resources:
      limits:
        memory: 512M
        cpus: '0.5'
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check PostgreSQL is running: `docker-compose -f docker-compose.prod.yml ps`
   - Verify password in `.env.prod`

2. **Frontend Can't Reach API**
   - Check `NEXT_PUBLIC_API_URL` in `.env.prod`
   - Verify CORS settings

3. **Newsletter Page Not Loading**
   - Rebuild frontend: `docker-compose -f docker-compose.prod.yml build frontend`
   - Check frontend logs: `docker-compose -f docker-compose.prod.yml logs frontend`

### Performance Tuning

1. **Database**
   - Increase connection pool: `DATABASE_MAX_CONNECTIONS=50`
   - Enable query optimization

2. **RSS Polling**
   - Adjust concurrent feeds: `RSS_MAX_CONCURRENT_FEEDS=15`
   - Optimize polling intervals

3. **Newsletter Processing**
   - Increase batch size for better performance
   - Enable caching for frequently accessed articles

## 📈 Production URLs

After deployment, access your application:

- **Homepage**: `http://localhost:3000`
- **Newsletter Curation**: `http://localhost:3000/newsletter`
- **Dashboard**: `http://localhost:3000/dashboard`
- **Settings**: `http://localhost:3000/settings`
- **API Health**: `http://localhost:3333/healthz`
- **API Documentation**: `http://localhost:3333/docs` (if enabled)

## 🎉 Success!

Your GlobalNewsLetter application with the new newsletter curation features is now running in production mode!