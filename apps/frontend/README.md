# GlobalNews Letter Frontend

A comprehensive Next.js 14+ web interface for the GlobalNews Letter RSS feed and translation system.

## Features

- **Dashboard**: System health overview, feed metrics, and translation analytics
- **Feed Management**: Create and manage RSS feed sources and instances
- **Article Management**: Browse, filter, and manage processed articles
- **Translation System**: Monitor translation jobs and bi-directional language processing
- **Health Monitoring**: Real-time system health and feed performance monitoring
- **Database Management**: Backup, restore, and database operations

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for data visualization
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 20 LTS
- Backend API running on http://localhost:3333

### Installation

1. Navigate to the frontend directory:
```bash
cd apps/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Update environment variables:
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3333
```

### Development

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Building for Production

```bash
npm run build
npm start
```

### Scripts from Root Directory

```bash
# Development
npm run dev:frontend          # Start frontend dev server
npm run dev:all              # Start both backend and frontend

# Building
npm run build:frontend       # Build frontend for production
npm run build:all           # Build both backend and frontend

# Quality Checks
npm run lint:frontend        # Run ESLint
npm run typecheck:frontend   # Run TypeScript compiler
```

## Project Structure

```
apps/frontend/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── page.tsx         # Dashboard
│   │   ├── feeds/           # Feed management
│   │   ├── articles/        # Article management
│   │   ├── translations/    # Translation system
│   │   ├── health/          # Health monitoring
│   │   └── database/        # Database management
│   ├── components/          # Reusable components
│   │   ├── dashboard/       # Dashboard components
│   │   ├── feeds/          # Feed management components
│   │   ├── articles/       # Article components
│   │   ├── translations/   # Translation components
│   │   ├── health/         # Health monitoring components
│   │   └── database/       # Database components
│   ├── lib/                # Utilities and API client
│   │   ├── api.ts          # Type-safe API client
│   │   └── providers.tsx   # React Query provider
│   └── globals.css         # Global styles
├── public/                 # Static assets
├── tailwind.config.js      # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
└── next.config.js         # Next.js configuration
```

## API Integration

The frontend uses a type-safe API client that communicates with the backend REST API:

- **Auto-retry**: Failed requests are automatically retried with exponential backoff
- **Error Handling**: Structured error responses following RFC 7807
- **Real-time Updates**: Components refresh data automatically using React Query
- **Optimistic Updates**: Form submissions show immediate feedback

## Key Components

### Dashboard
- System health overview with component status
- Real-time metrics for feeds and translations
- Recent activity feed
- Performance charts and analytics

### Feed Management
- Create and configure RSS feed sources
- Manage feed instances with refresh tiers
- Monitor feed health and performance
- Language and category filtering

### Article Management
- Browse processed articles with advanced filtering
- View article metadata and processing stages
- Content quality and urgency indicators
- Language detection confidence scores

### Translation System
- Monitor translation job queue and status
- Track language pair performance
- View bi-directional translation metrics
- Quality scoring and processing analytics

### Health Monitoring
- Real-time system health dashboard
- Feed performance monitoring
- System logs with filtering
- Alert management

### Database Management
- Create and manage database backups
- Restore from backup files
- Database wipe functionality (with confirmations)
- Backup file management

## Development Guidelines

### Code Style
- Use TypeScript strict mode
- Follow Next.js App Router patterns
- Implement proper error boundaries
- Use React Hook Form for all forms
- Validate all data with Zod schemas

### Performance
- Implement proper loading states
- Use React Query for caching
- Optimize images and assets
- Follow Next.js performance best practices

### Security
- Validate all user inputs
- Sanitize API responses
- Use HTTPS in production
- Follow OWASP security guidelines

## Contributing

1. Follow the existing code style and patterns
2. Add proper TypeScript types for all new code
3. Include loading and error states for all async operations
4. Test components with various data states
5. Update documentation for new features

## Troubleshooting

### Common Issues

**API Connection Failed**
- Ensure backend is running on the correct port
- Check CORS configuration
- Verify environment variables

**Build Errors**
- Run `npm run typecheck:frontend` to check for TypeScript errors
- Ensure all dependencies are installed
- Check for missing environment variables

**Performance Issues**
- Monitor network requests in dev tools
- Check React Query cache configuration
- Verify image optimization settings