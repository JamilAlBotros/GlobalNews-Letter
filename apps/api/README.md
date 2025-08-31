# GlobalNews Letter API

Simple news feed aggregation API built with Fastify, TypeScript, and SQLite.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database
npm run db:init

# Start development server
npm run dev

# Server will be running at http://localhost:3333
```

## API Endpoints

- `GET /healthz` - Health check
- `GET /readyz` - Readiness check
- `GET /feeds` - List feeds with pagination
- `POST /feeds` - Create new feed
- `GET /feeds/:id` - Get feed by ID
- `PUT /feeds/:id` - Update feed
- `DELETE /feeds/:id` - Delete feed
- `GET /articles` - List articles with pagination, optional feed_id filter
- `POST /articles` - Create new article
- `GET /articles/:id` - Get article by ID
- `PUT /articles/:id` - Update article
- `DELETE /articles/:id` - Delete article

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Build

```bash
# Type check
npm run typecheck

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
NODE_ENV=development
DATABASE_PATH=data/news.db
PORT=3333
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,http://localhost:3333
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

## Database Schema

**feeds table:**
- id (UUID primary key)
- name (string)
- url (string, unique)
- language (enum)
- region (string)
- category (enum)
- type (enum)
- is_active (boolean)
- created_at, updated_at (timestamps)

**articles table:**
- id (UUID primary key)
- feed_id (UUID, foreign key to feeds)
- title (string)
- description (nullable string)
- content (nullable string)
- url (string, unique)
- published_at (timestamp)
- scraped_at, created_at (timestamps)