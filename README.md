# 🌍 GlobalNews Letter

A modern RSS news aggregation system with web interface and API backend. Built with TypeScript following MVP-first principles for rapid development and testing.

## ✨ Features

- **RSS Feed Management**: Add, manage, and monitor RSS news feeds
- **Multi-Language Support**: English, Spanish, Portuguese, French, Arabic, Chinese, Japanese
- **Web Interface**: React-based dashboard for feed and article management
- **REST API**: Fastify-powered backend with OpenAPI documentation
- **Type Safety**: Full TypeScript with Zod validation throughout
- **Modern Stack**: Monorepo with Next.js frontend and Fastify API

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ LTS
- npm (workspaces supported)
- Git

### Installation

1. **Clone and install dependencies:**
```bash
git clone <your-repo>
cd GlobalNewsLetter
npm install
```

2. **Set up environment:**
Copy and configure environment files:
```bash
# API environment (optional - has defaults)
cp apps/api/.env.example apps/api/.env

# Frontend environment (optional - has defaults)  
cp apps/frontend/.env.example apps/frontend/.env
```

Default configuration works out of the box for development.

### Development

#### Start Development Servers

**Option 1 - Start Everything (Recommended):**
```bash
npm run dev:all
# Starts both API (localhost:3333) and Frontend (localhost:3000)
# Uses concurrently with colored output for easy monitoring
```

**Option 2 - Start Individually:**

**Terminal 1 - API Server:**
```bash
npm run dev:api
# API runs on http://localhost:3333
# Health checks: /healthz and /readyz
```

**Terminal 2 - Frontend Server:**
```bash
npm run dev:frontend
# Web UI runs on http://localhost:3000
```

**Generate Contracts (when needed):**
```bash
npm run contracts:gen
# Regenerates OpenAPI schemas and TypeScript clients
```

#### Key Development URLs

- **Frontend**: http://localhost:3000
- **API**: http://localhost:3333
- **API Health**: http://localhost:3333/healthz
- **API Readiness**: http://localhost:3333/readyz

## 📁 Project Structure

```
GlobalNews Letter/
├── apps/
│   ├── api/                   # Fastify API server
│   │   ├── src/
│   │   │   ├── database/      # SQLite connection and initialization
│   │   │   ├── routes/        # API endpoints (feeds, articles)
│   │   │   ├── middleware/    # CORS, rate limiting, logging
│   │   │   └── server.ts      # Main server setup
│   │   ├── data/              # SQLite database files
│   │   └── package.json
│   └── frontend/              # Next.js React app
│       ├── src/
│       │   ├── components/    # React components (feeds, articles)
│       │   ├── lib/           # API client and utilities
│       │   └── app/           # Next.js App Router pages
│       └── package.json
├── packages/
│   └── contracts/             # Shared schemas and OpenAPI
│       ├── src/schemas/       # Zod validation schemas
│       ├── openapi.json       # Generated OpenAPI spec
│       └── openapi.gen.ts     # Generated TypeScript client
├── CLAUDE.md                  # Development guidelines
├── package.json               # Monorepo configuration
└── pnpm-workspace.yaml        # Workspace configuration
```

## 🧪 Testing

### Run All Tests
```bash
# From root - runs tests for all workspaces
npm run test

# Or run tests individually
cd apps/api && npm test
cd apps/frontend && npm test
```

### API Testing with curl

**Health Checks:**
```bash
curl http://localhost:3333/healthz
curl http://localhost:3333/readyz
```

**Create a Feed:**
```bash
curl -X POST http://localhost:3333/feeds \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechCrunch",
    "url": "https://techcrunch.com/feed/",
    "language": "English",
    "region": "United States",
    "category": "Technology", 
    "type": "News"
  }'
```

**List Feeds:**
```bash
curl http://localhost:3333/feeds
```

**List Articles:**
```bash
curl http://localhost:3333/articles
```

### Quality Gates
```bash
# Type check  
npm run typecheck

# Contract generation
npm run contracts:gen
```

## 🔧 Configuration

### Environment Variables

**API Server (.env):**
```env
NODE_ENV=development
PORT=3333
DATABASE_URL="file:./data/news.db"
CORS_ORIGINS="http://localhost:3000"
RATE_LIMIT_RPS=10
```

**Frontend (.env):**
```env
NEXT_PUBLIC_API_BASE_URL="http://localhost:3333"
```

### Supported Categories & Languages

**Categories:**
News, Technology, Finance, Science, Sports, Entertainment, Health, Travel, Education, Business, Politics, Gaming, Crypto, Lifestyle

**Languages:**
English, Spanish, Portuguese, French, Arabic, Chinese, Japanese

## 🔌 API Endpoints

### Feeds
```
GET    /feeds              # List all feeds (paginated)
POST   /feeds              # Create new feed
GET    /feeds/:id          # Get specific feed
PUT    /feeds/:id          # Update feed
DELETE /feeds/:id          # Delete feed
```

### Articles
```
GET    /articles           # List all articles (paginated)  
POST   /articles           # Create new article
GET    /articles/:id       # Get specific article
PUT    /articles/:id       # Update article
DELETE /articles/:id       # Delete article
```

### Health
```
GET    /healthz            # Health check (always returns 200)
GET    /readyz             # Readiness check (validates database)
```

### Example API Responses

**Feed Object:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "TechCrunch",
  "url": "https://techcrunch.com/feed/",
  "language": "English",
  "region": "United States", 
  "category": "Technology",
  "type": "News",
  "is_active": true,
  "created_at": "2024-08-29T10:30:00.000Z",
  "updated_at": "2024-08-29T10:30:00.000Z"
}
```

**Article Object:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440001",
  "feed_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "AI Breakthrough in Language Models",
  "description": "New developments in artificial intelligence...",
  "content": "Full article content here...",
  "url": "https://techcrunch.com/2024/08/29/ai-breakthrough/",
  "published_at": "2024-08-29T09:45:00.000Z",
  "scraped_at": "2024-08-29T10:30:00.000Z",
  "created_at": "2024-08-29T10:30:00.000Z"
}
```

## 🛠️ Development

### Available Commands

**Monorepo Root:**
```bash
npm install               # Install all dependencies
npm run dev:all           # Start API + Frontend servers  
npm run contracts:gen     # Generate OpenAPI schemas
npm run test              # Run tests in all workspaces
npm run typecheck         # Type check all code
```

**API Server (apps/api):**
```bash
npm run dev               # Start development server
npm run build             # Build for production
npm run start             # Start production server  
npm test                  # Run API tests
npm run db:init           # Initialize database
```

**Frontend (apps/frontend):**
```bash
npm run dev               # Start development server
npm run build             # Build for production
npm run start             # Start production server
npm test                  # Run frontend tests
```

### Architecture

Built following CLAUDE.md MVP principles:

- **Contract-First**: OpenAPI schemas generate TypeScript clients
- **Type Safety**: Zod validation at all API boundaries  
- **Structured Errors**: RFC 7807 problem+json error responses
- **Health Monitoring**: /healthz and /readyz endpoints
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Logging**: Structured JSON logs with request IDs
- **Rate Limiting**: Per-IP token bucket protection

### Database Schema

**feeds table:**
- `id` (TEXT PRIMARY KEY) - UUID
- `name` (TEXT) - Feed display name
- `url` (TEXT UNIQUE) - RSS feed URL
- `language` (TEXT) - Content language
- `region` (TEXT) - Geographic region
- `category` (TEXT) - Content category
- `type` (TEXT) - Content type
- `is_active` (BOOLEAN) - Active status
- `created_at` (TEXT) - Creation timestamp
- `updated_at` (TEXT) - Last update timestamp

**articles table:**
- `id` (TEXT PRIMARY KEY) - UUID
- `feed_id` (TEXT) - Foreign key to feeds.id
- `title` (TEXT) - Article title
- `description` (TEXT) - Article summary
- `content` (TEXT) - Full article content
- `url` (TEXT UNIQUE) - Article URL
- `published_at` (TEXT) - Original publish date
- `scraped_at` (TEXT) - When scraped
- `created_at` (TEXT) - Database creation time

## 🚧 Current Status

**Completed:**
✅ REST API with full CRUD operations  
✅ React web interface with feed/article management  
✅ Type-safe client generation from OpenAPI  
✅ SQLite database with proper indexing  
✅ Unit tests for all API endpoints  
✅ Health monitoring and graceful shutdown  
✅ CORS and rate limiting  

**Next Steps:**
- RSS feed parsing and article scraping
- Automated feed polling scheduler
- Article deduplication and content analysis
- Email newsletter generation
- User authentication and feed subscriptions

## 📄 License

MIT License

---

**Built with TypeScript, Next.js, Fastify, and SQLite following MVP-first development principles.**