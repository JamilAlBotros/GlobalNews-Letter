# GlobalNews Letter - User Guide & Wiki

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [RSS Feed Management](#rss-feed-management)
4. [Translation System](#translation-system)
5. [Health Monitoring](#health-monitoring)
6. [API Reference](#api-reference)
7. [Troubleshooting](#troubleshooting)

---

## Overview

GlobalNews Letter is a multilingual RSS feed aggregation and translation system that automatically collects news from various sources, translates them bi-directionally across 7 languages, and provides intelligent feed management with health monitoring.

### Supported Languages
- **English** (en) - Primary language with fastest processing
- **Spanish** (es) - High-quality translation support
- **Portuguese** (pt) - Growing model support
- **French** (fr) - Established translation quality
- **Arabic** (ar) - Right-to-left language with specialized handling
- **Chinese** (zh) - Complex tokenization handling
- **Japanese** (ja) - Advanced character processing

### Content Categories
- **Finance** - Financial news, market updates, investment analysis
- **Tech** - Technology news, startup updates, product launches
- **Health** - Medical news, research updates, wellness content
- **crypto** - Crypto news
- **General** - Broader news coverage

---

## Getting Started

### Prerequisites
```bash
# Install dependencies
pnpm install

# Initialize the enhanced database
npm run db:init

# Start the services
npm run dev
```

### Environment Configuration
Create `.env` file with:
```env
DATABASE_PATH="data/enhanced-rss.db"
API_BASE_URL="http://localhost:3333"
LLM_API_KEY="your-llm-api-key"
MAX_CONCURRENT_TRANSLATIONS=3
HEALTH_CHECK_INTERVAL=300000
```

---

## RSS Feed Management

### Understanding Feed Structure

The system uses a two-tier approach:

1. **Feed Sources** - Master definitions of content providers
2. **Feed Instances** - Specific RSS feed URLs with processing configurations

### Adding RSS Feeds to Database

#### Method 1: Using API Endpoints

**Step 1: Create a Feed Source**
```bash
curl -X POST http://localhost:3333/api/v2/feeds/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Reuters Finance",
    "base_url": "https://reuters.com",
    "provider_type": "rss",
    "source_language": "en",
    "primary_region": "us",
    "content_category": "finance",
    "content_type": "breaking"
  }'
```

**Step 2: Create Feed Instance(s)**
```bash
curl -X POST http://localhost:3333/api/v2/feeds/instances \
  -H "Content-Type: application/json" \
  -d '{
    "source_id": "your-source-id-from-step-1",
    "instance_name": "Reuters Finance - Breaking News",
    "feed_url": "https://feeds.reuters.com/reuters/businessNews",
    "refresh_tier": "frequent",
    "base_refresh_minutes": 30,
    "adaptive_refresh": true
  }'
```

#### Method 2: Using Database Service Directly

```typescript
import { EnhancedDatabaseService } from './src/services/enhanced-database.js';

const db = new EnhancedDatabaseService();
await db.initialize();

// Create feed source
await db.saveFeedSource({
  id: uuidv4(),
  name: "TechCrunch",
  base_url: "https://techcrunch.com",
  provider_type: "rss",
  source_language: "en",
  primary_region: "us",
  content_category: "tech",
  content_type: "daily",
  is_active: true,
  quality_score: 0.5
});

// Create feed instance
await db.saveFeedInstance({
  id: uuidv4(),
  source_id: "your-source-id",
  instance_name: "TechCrunch Main Feed",
  feed_url: "https://techcrunch.com/feed/",
  refresh_tier: "standard",
  base_refresh_minutes: 60,
  adaptive_refresh: true,
  consecutive_failures: 0,
  avg_articles_per_fetch: 0,
  reliability_score: 1.0,
  is_active: true
});
```

### Feed Labeling Guide

#### Content Categories
Choose the most specific category:

- **finance**: Stock market, trading, economic analysis, company earnings
- **tech**: Software, hardware, startups, AI, cybersecurity
- **health**: Medical research, pharmaceuticals, wellness, public health
- **general**: Politics, sports, entertainment, international news

#### Content Types
Select based on update frequency and urgency:

- **breaking**: Real-time news, alerts, market-moving events
- **daily**: Regular daily updates, standard news cycle
- **analysis**: Opinion pieces, deep-dive reports, weekly summaries
- **weekly**: Long-form content, research reports

#### Refresh Tiers
Match to content velocity and importance:

```typescript
// Refresh tier selection guide
const REFRESH_TIER_GUIDE = {
  realtime: {
    use_for: "Breaking news, market alerts, crisis updates",
    refresh_minutes: "5-15 minutes",
    categories: ["finance", "tech"],
    examples: ["Reuters breaking", "Bloomberg markets", "TechCrunch breaking"]
  },
  frequent: {
    use_for: "Important daily updates, trending topics",
    refresh_minutes: "30-120 minutes", 
    categories: ["finance", "tech", "health"],
    examples: ["CNN Tech", "WSJ Finance", "Medical News Today"]
  },
  standard: {
    use_for: "Regular news, general updates",
    refresh_minutes: "60-360 minutes",
    categories: ["general", "health"],
    examples: ["BBC News", "NPR", "Health.com"]
  },
  slow: {
    use_for: "Analysis, opinion, weekly content",
    refresh_minutes: "240-1440 minutes",
    categories: ["analysis"],
    examples: ["The Economist", "Harvard Business Review"]
  }
};
```

### Language-Specific Considerations

#### Source Language Selection
- **en**: Best for US/UK sources, fastest processing
- **es**: Use for Spanish-language sources (Spain, Latin America)
- **pt**: Portuguese sources (Brazil, Portugal)
- **fr**: French sources (France, Canada, Africa)
- **ar**: Arabic sources (Middle East, North Africa)
- **zh**: Chinese sources (China, Taiwan, Hong Kong)
- **ja**: Japanese sources

#### Regional Mapping
```typescript
const REGION_LANGUAGE_MAP = {
  // English regions
  "us": "en", "gb": "en", "ca": "en", "au": "en",
  
  // Spanish regions  
  "es": "es", "mx": "es", "ar": "es", "co": "es",
  
  // Portuguese regions
  "br": "pt", "pt": "pt",
  
  // French regions
  "fr": "fr", "ca": "fr",
  
  // Arabic regions
  "sa": "ar", "ae": "ar", "eg": "ar",
  
  // Chinese regions
  "cn": "zh", "tw": "zh", "hk": "zh",
  
  // Japanese regions
  "jp": "ja"
};
```

### Example Feed Configurations

#### High-Frequency Financial Feed
```json
{
  "source": {
    "name": "Bloomberg Markets",
    "base_url": "https://bloomberg.com",
    "provider_type": "rss",
    "source_language": "en",
    "primary_region": "us",
    "content_category": "finance",
    "content_type": "breaking"
  },
  "instance": {
    "instance_name": "Bloomberg Markets - Real-time",
    "feed_url": "https://feeds.bloomberg.com/markets/news.rss",
    "refresh_tier": "realtime",
    "base_refresh_minutes": 10,
    "adaptive_refresh": true
  }
}
```

#### Multi-Language Health Feed
```json
{
  "source": {
    "name": "El País Salud",
    "base_url": "https://elpais.com",
    "provider_type": "rss", 
    "source_language": "es",
    "primary_region": "es",
    "content_category": "health",
    "content_type": "daily"
  },
  "instance": {
    "instance_name": "El País - Sección Salud",
    "feed_url": "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/salud",
    "refresh_tier": "standard",
    "base_refresh_minutes": 90,
    "adaptive_refresh": true
  }
}
```

#### Analysis Content Feed
```json
{
  "source": {
    "name": "Harvard Business Review",
    "base_url": "https://hbr.org",
    "provider_type": "rss",
    "source_language": "en",
    "primary_region": "us",
    "content_category": "general",
    "content_type": "analysis"
  },
  "instance": {
    "instance_name": "HBR - Latest Articles",
    "feed_url": "https://feeds.hbr.org/harvardbusiness",
    "refresh_tier": "slow",
    "base_refresh_minutes": 480,
    "adaptive_refresh": false
  }
}
```

### Batch Feed Addition

For adding multiple feeds, create a JSON configuration file:

```json
{
  "feeds": [
    {
      "source": {
        "name": "Reuters Business",
        "base_url": "https://reuters.com",
        "provider_type": "rss",
        "source_language": "en",
        "content_category": "finance",
        "content_type": "breaking"
      },
      "instances": [
        {
          "name": "Reuters Business News",
          "url": "https://feeds.reuters.com/reuters/businessNews",
          "tier": "frequent"
        },
        {
          "name": "Reuters Market News", 
          "url": "https://feeds.reuters.com/reuters/marketsNews",
          "tier": "realtime"
        }
      ]
    }
  ]
}
```

Then use the batch import script:
```bash
node scripts/import-feeds.js feeds-config.json
```

### Feed Quality Optimization

#### Quality Score Factors
The system automatically calculates quality scores based on:

1. **Reliability** (40%): Success rate, uptime, consistent updates
2. **Content Quality** (30%): Language confidence, article completeness
3. **Freshness** (20%): New articles per fetch, content velocity
4. **Response Time** (10%): Feed response speed

#### Improving Feed Quality
- Use official RSS feeds from reputable sources
- Choose appropriate refresh tiers to avoid over-polling
- Monitor feed health metrics regularly
- Remove consistently failing feeds

---

## Translation System

### How Translation Works

1. **Article Processing**: Original articles are processed for language detection
2. **Job Creation**: Translation jobs are queued based on priority and target languages
3. **Translation Execution**: AI models translate content with quality scoring
4. **Quality Control**: Low-quality translations are flagged for review
5. **Publishing**: High-quality translations are made available

### Creating Translation Jobs

```bash
# Create translation job for an article
curl -X POST http://localhost:3333/api/v2/translations \
  -H "Content-Type: application/json" \
  -d '{
    "original_article_id": "article-uuid",
    "target_languages": ["es", "pt", "fr"],
    "priority": "normal"
  }'
```

### Bulk Translation for Urgent Content

```bash
# Translate all breaking news to key languages
curl -X POST http://localhost:3333/api/v2/translations/bulk \
  -H "Content-Type: application/json" \
  -d '{
    "urgency_level": "breaking",
    "target_languages": ["es", "ar", "pt"],
    "limit": 20
  }'
```

### Translation Quality Guidelines

- **0.9-1.0**: Excellent - Ready for publication
- **0.8-0.9**: Good - Minor review recommended  
- **0.7-0.8**: Acceptable - Review recommended
- **0.6-0.7**: Poor - Human review required
- **0.0-0.6**: Failed - Requires retranslation

---

## Health Monitoring

### System Health Endpoints

```bash
# Check overall system health
curl http://localhost:3333/api/v2/health

# Get detailed performance metrics
curl http://localhost:3333/api/v2/analytics/performance?days=7

# Get feed performance summary
curl http://localhost:3333/api/v2/analytics/feeds

# Get translation queue status
curl http://localhost:3333/api/v2/feeds/queue/metrics
```

### Monitoring Alerts

The system generates alerts for:
- Feed reliability below 70%
- Translation quality below 75%
- Queue backlog over 200 jobs
- High response times (>5 seconds)
- System failures

### Maintenance Tasks

```bash
# Run system maintenance (cleanup old data, retry failed jobs)
curl -X POST http://localhost:3333/api/v2/maintenance

# Manual feed processing trigger
curl -X POST http://localhost:3333/api/v2/feeds/process \
  -H "Content-Type: application/json" \
  -d '{"tier": "frequent", "concurrency": 3}'
```

---

## API Reference

### Feed Sources
- `GET /api/v2/feeds/sources` - List sources with filters
- `POST /api/v2/feeds/sources` - Create new source
- `PUT /api/v2/feeds/sources/:id` - Update source
- `DELETE /api/v2/feeds/sources/:id` - Delete source

### Feed Instances  
- `GET /api/v2/feeds/instances` - List instances
- `POST /api/v2/feeds/instances` - Create instance
- `PUT /api/v2/feeds/instances/:id` - Update instance

### Articles
- `GET /api/v2/articles` - List articles with filters
- `POST /api/v2/articles/:id/select` - Mark for newsletter

### Translations
- `GET /api/v2/translations` - List translations
- `POST /api/v2/translations` - Create translation job
- `POST /api/v2/translations/bulk` - Bulk translation

### Health & Analytics
- `GET /api/v2/health` - System health check
- `GET /api/v2/analytics/performance` - Performance metrics
- `GET /api/v2/analytics/feeds` - Feed statistics

---

## Troubleshooting

### Common Issues

#### Feed Not Updating
1. Check feed reliability score: `GET /api/v2/analytics/feeds`
2. Verify RSS URL is accessible
3. Check refresh tier settings
4. Review error logs in health metrics

#### Translation Queue Backlog
1. Check queue metrics: `GET /api/v2/feeds/queue/metrics`
2. Increase concurrent workers in config
3. Review failed translation jobs
4. Check LLM API rate limits

#### Poor Translation Quality
1. Review language pair performance
2. Adjust translation model settings
3. Check source content quality
4. Consider human review thresholds

#### Database Performance Issues
1. Run maintenance: `POST /api/v2/maintenance`
2. Check database size and cleanup old articles
3. Review index performance
4. Consider WAL mode optimization

### Debug Mode

Enable detailed logging:
```env
DEBUG=true
LOG_LEVEL=debug
ENABLE_QUERY_LOGGING=true
```

### Health Check Script

Create a monitoring script:
```bash
#!/bin/bash
# health-check.sh

HEALTH_ENDPOINT="http://localhost:3333/api/v2/health"
RESPONSE=$(curl -s $HEALTH_ENDPOINT)
STATUS=$(echo $RESPONSE | jq -r '.status')

if [ "$STATUS" != "healthy" ]; then
  echo "⚠️ System health: $STATUS"
  echo $RESPONSE | jq '.feeds, .translations'
else
  echo "✅ System is healthy"
fi
```

---

## Best Practices

### Feed Management
1. Start with a few high-quality feeds and expand gradually
2. Use appropriate refresh tiers to balance freshness and performance  
3. Monitor feed quality scores and remove poor performers
4. Group similar content sources under the same feed source

### Translation Strategy
1. Prioritize high-urgency content for immediate translation
2. Use bulk translation for related articles
3. Monitor translation quality trends by language pair
4. Set up human review for critical content categories

### Performance Optimization
1. Enable adaptive refresh for most feeds
2. Use realtime tier sparingly for truly urgent content
3. Monitor system resources and scale accordingly
4. Regular maintenance to cleanup old data

### Security Considerations
1. Validate all RSS URLs before adding to database
2. Sanitize article content before translation
3. Monitor for unusual activity patterns
4. Regular security updates for dependencies

---

*For additional support, check the GitHub issues or create a new issue with detailed information about your use case.*