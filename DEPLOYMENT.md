# GlobalNews-Letter Deployment Guide

This guide covers deploying the GlobalNews-Letter application with the external nginx reverse proxy for remote access.

## Quick Start with External Proxy

### Prerequisites

1. **External Nginx Reverse Proxy** - Set up the shared nginx proxy:
   ```bash
   git clone <nginx-reverse-proxy-repo> ../nginx-reverse-proxy
   cd ../nginx-reverse-proxy
   docker compose up -d
   ```

2. **Models Directory** - Place your NLLB and LLaMA models:
   ```bash
   mkdir -p models/nllb-200 models/llama-3-8b
   # Copy your model files to respective directories
   ```

### Deployment Steps

1. **Start the Newsletter Application**
   ```bash
   # In the GlobalNews-Letter directory
   docker compose up -d
   ```

2. **Add Application to Proxy**
   ```bash
   # From the nginx-reverse-proxy directory
   cd ../nginx-reverse-proxy
   ./scripts/add-app.sh --name globalnews --host news.local
   ```

3. **Configure Local Access (Development)**
   ```bash
   # Add to your /etc/hosts file
   echo "127.0.0.1 news.local" | sudo tee -a /etc/hosts
   ```

4. **Access Your Application**
   - Frontend: http://news.local
   - API Health: http://news.local/health/globalnews
   - LLM API: http://news.local/llm/health

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                      │
│                     (Port 80/443)                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                GlobalNews-Letter App                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐│
│  │  Frontend   │ │     API     │ │       LLM API           ││
│  │ (Port 3000) │ │ (Port 3333) │ │    (Port 8000)          ││
│  └─────────────┘ └─────────────┘ └─────────────────────────┘│
│                      │                                       │
│                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              PostgreSQL Database                        ││
│  │                 (Port 5432)                            ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Network Configuration

The application uses two Docker networks:

1. **Internal Network (`globalnews_network`)**
   - Database communication
   - Service-to-service communication
   - Isolated from external access

2. **External Network (`nginx-proxy-network`)**
   - Shared with the reverse proxy
   - Allows proxy to reach frontend, API, and LLM services
   - Enables multiple applications through single entry point

## Service Configuration

### Port Mappings

- **Database**: `127.0.0.1:5432:5432` (localhost only)
- **API**: `127.0.0.1:3333:3333` (localhost only)
- **LLM API**: `127.0.0.1:8000:8000` (localhost only)
- **Frontend**: `127.0.0.1:3000:3000` (localhost only)

All services are accessible locally for development and debugging, but external access goes through the nginx proxy.

### External Access Routes

| Route | Target | Purpose |
|-------|--------|---------|
| `/` | Frontend:3000 | Main application UI |
| `/api/*` | API:3333 | Backend API endpoints |
| `/llm/*` | LLM API:8000 | Translation/summarization |
| `/health/globalnews` | API:3333/healthz | Health monitoring |

## Production Deployment

### 1. Server Setup

```bash
# On your server
git clone <this-repo> GlobalNews-Letter
git clone <nginx-reverse-proxy-repo> nginx-reverse-proxy

cd GlobalNews-Letter
# Place your models in ./models/ directory
```

### 2. Environment Configuration

Create production environment file:

```bash
# .env.production
NODE_ENV=production
DB_PASSWORD=your-secure-database-password
```

### 3. Start Services

```bash
# Start the newsletter app
docker compose --env-file .env.production up -d

# Add to proxy (use your server's IP)
cd ../nginx-reverse-proxy
./scripts/add-app.sh --name globalnews --host your-domain.com --upstream YOUR_SERVER_IP --ssl
```

### 4. SSL Configuration

For production with real SSL certificates:

```bash
# Place your SSL certificates in nginx-reverse-proxy/certs/
# your-domain.com.crt
# your-domain.com.key

# Or use Let's Encrypt
# (See nginx-reverse-proxy documentation for automated SSL setup)
```

## Development Workflow

### Local Development

1. **Start Newsletter App**
   ```bash
   docker compose up -d
   ```

2. **Direct Access (without proxy)**
   - Frontend: http://localhost:3000
   - API: http://localhost:3333
   - LLM API: http://localhost:8000

3. **Proxy Access**
   ```bash
   # Add to proxy
   cd ../nginx-reverse-proxy
   ./scripts/add-app.sh --name globalnews-dev --host dev.news.local

   # Access via http://dev.news.local
   ```

### Multiple Environments

You can run multiple instances for different environments:

```bash
# Development environment
./scripts/add-app.sh --name globalnews-dev --host dev.news.local --ports 3000:3333:8000

# Staging environment
./scripts/add-app.sh --name globalnews-staging --host staging.news.local --ports 3010:3343:8010

# Production environment
./scripts/add-app.sh --name globalnews --host news.example.com --ports 3020:3353:8020 --ssl
```

## Monitoring and Logs

### Application Logs
```bash
# Newsletter app logs
docker compose logs -f

# Specific service logs
docker compose logs -f api
docker compose logs -f llm-api
docker compose logs -f frontend
```

### Proxy Logs
```bash
# From nginx-reverse-proxy directory
docker compose logs -f nginx-proxy

# Access logs
docker compose exec nginx-proxy tail -f /var/log/nginx/access.log

# Error logs
docker compose exec nginx-proxy tail -f /var/log/nginx/error.log
```

### Health Monitoring

```bash
# Application health
curl http://news.local/health/globalnews

# Proxy health
curl http://news.local/health

# Direct service health (development)
curl http://localhost:3333/healthz
curl http://localhost:8000/health
```

## Troubleshooting

### Common Issues

1. **Cannot Connect to Proxy**
   ```bash
   # Check proxy is running
   cd ../nginx-reverse-proxy
   docker compose ps

   # Check proxy logs
   docker compose logs nginx-proxy
   ```

2. **Application Not Starting**
   ```bash
   # Check service status
   docker compose ps

   # Check specific service
   docker compose logs api
   ```

3. **Network Issues**
   ```bash
   # Verify external network exists
   docker network ls | grep nginx-proxy-network

   # Recreate network if needed
   docker network rm nginx-proxy-network
   cd ../nginx-reverse-proxy
   docker compose up -d
   ```

4. **Port Conflicts**
   ```bash
   # Check port usage
   sudo netstat -tulpn | grep -E ':(80|3000|3333|8000)'

   # Stop conflicting services
   sudo systemctl stop apache2  # if Apache is running
   ```

### Reset and Restart

```bash
# Complete reset
docker compose down -v
cd ../nginx-reverse-proxy
docker compose down
docker network prune -f
docker volume prune -f

# Restart everything
docker compose up -d  # nginx proxy first
cd ../GlobalNews-Letter
docker compose up -d  # then newsletter app

# Re-add to proxy
cd ../nginx-reverse-proxy
./scripts/add-app.sh --name globalnews --host news.local
```

## Security Considerations

### Development
- Services bound to localhost only
- Database accessible from host for development
- Self-signed SSL certificates

### Production
- Use real SSL certificates
- Configure firewall rules
- Regular security updates
- Monitor access logs
- Use strong database passwords
- Consider VPN access for admin functions

## Backup and Maintenance

### Database Backup
```bash
# Create backup
docker compose exec db pg_dump -U globalnews globalnews > backup.sql

# Restore backup
docker compose exec -T db psql -U globalnews globalnews < backup.sql
```

### Configuration Backup
```bash
# Backup docker configurations
tar -czf globalnews-config-$(date +%Y%m%d).tar.gz \
  docker-compose.yml .env* models/

# Backup proxy configuration
cd ../nginx-reverse-proxy
tar -czf nginx-proxy-config-$(date +%Y%m%d).tar.gz config/ certs/
```

---

🚀 **Your GlobalNews-Letter application is now ready for remote access through the shared nginx proxy!** 🚀