# 🌍 GlobalNews Letter

A multi-language news aggregation and curation system that fetches, processes, and curates articles from various sources into customizable newsletters.

## ✨ Features

- **Multi-Source News Fetching**: Integration with NewsAPI for finance and tech news
- **AI Summarization**: Local LLM integration (Ollama) for article summaries
- **Multi-Language Support**: English, Spanish, and Arabic with translation capabilities
- **Smart Filtering**: Category-based filtering (Finance, Technology) with search functionality
- **Interactive CLI**: Easy-to-use command-line interfaces for article management
- **JSON Export**: Generate structured newsletters in JSON format
- **Scalable Architecture**: Designed for easy expansion to multiple APIs and web scrapers

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- npm or pnpm
- NewsAPI key (free at [newsapi.org](https://newsapi.org))
- Optional: Ollama for AI summaries

### Installation

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Set up environment:**
Create `.local.env` with your NewsAPI key:
```env
NEWSAPI_API_KEY="your_api_key_here"
# Optional LLM settings
LLM_API_URL="http://localhost:11434"
LLM_MODEL="codellama:7b"
```

3. **Optional - Set up Ollama for AI summaries:**
```bash
# Install Ollama (see ollama.ai)
ollama pull codellama:7b
# Ollama runs automatically on localhost:11434
```

### Usage

#### 1. Fetch Articles
```bash
npm run fetch
```
Interactive CLI for:
- Fetching articles by category (Finance/Tech)
- Getting top headlines
- Searching with keywords
- Viewing stored articles
- Database statistics

#### 2. Generate Newsletter
```bash
npm run generate
```
Interactive CLI for:
- Selecting articles for newsletter
- Choosing output language
- Generating JSON newsletters
- Translating articles
- Managing selections

#### 3. Test Services
```bash
npm run dev
```
Check connectivity to NewsAPI and LLM services.

## 📁 Project Structure

```
GlobalNews Letter/
├── src/
│   ├── cli/                    # Command-line interfaces
│   │   ├── fetch.ts           # Article fetching CLI
│   │   └── generate.ts        # Newsletter generation CLI
│   ├── config/                # Configuration and constants
│   │   └── index.ts           # App configuration
│   ├── providers/             # External API providers
│   │   └── newsapi.ts         # NewsAPI integration
│   ├── services/              # Core business logic
│   │   ├── articles.ts        # Article management
│   │   ├── database.ts        # SQLite database service
│   │   ├── llm.ts             # Local LLM integration
│   │   └── newsletter.ts      # Newsletter generation
│   ├── types/                 # TypeScript type definitions
│   │   └── index.ts           # Shared types and schemas
│   └── index.ts               # Main application entry
├── data/                      # SQLite database files
├── output/                    # Generated newsletters
├── .local.env                 # Environment variables
├── package.json              # Dependencies and scripts
└── tsconfig.json             # TypeScript configuration
```

## 🔧 Configuration

### Environment Variables (.local.env)

```env
# Required
NEWSAPI_API_KEY="your_newsapi_key"

# Optional - API URLs
NEWSAPI_BASE_URL="https://newsapi.org/v2"
LLM_API_URL="http://localhost:11434"

# Optional - Settings
LLM_MODEL="codellama:7b"
DATABASE_PATH="./data/articles.db"
OUTPUT_DIR="./output"
```

### Categories and Languages

**Supported Categories:**
- Finance: banking, cryptocurrency, stock market, investment, economy
- Technology: AI, software, startups, programming, tech companies

**Supported Languages:**
- English
- Spanish  
- Arabic

## 📊 Newsletter Output Format

Generated newsletters are saved as JSON files with this structure:

```json
{
  "generatedAt": "2024-08-24T10:30:00.000Z",
  "language": "english",
  "totalArticles": 5,
  "metadata": {
    "categories": ["finance", "tech"],
    "sources": ["TechCrunch", "Bloomberg", "Reuters"],
    "dateRange": {
      "earliest": "2024-08-23T12:00:00.000Z",
      "latest": "2024-08-24T09:45:00.000Z"
    }
  },
  "articlesByCategory": {
    "finance": [
      {
        "title": "Market Update: Tech Stocks Rally",
        "author": "John Doe",
        "source": "Bloomberg",
        "publishedAt": "2024-08-24T09:45:00.000Z",
        "summary": "AI-generated summary of the article...",
        "link": "https://example.com/article1"
      }
    ],
    "tech": [...]
  }
}
```

## 🛠️ Development

### Available Commands

| Category | Command | Purpose | Options/Arguments |
|----------|---------|---------|-------------------|
| **📰 Article Management** | | | |
| | `npm run fetch` | Interactive CLI for fetching articles from NewsAPI | Categories: Finance/Tech, Search keywords, Top headlines |
| | `npm run generate` | Interactive newsletter generation CLI | Language selection, Article filtering, JSON export |
| **🔍 RSS Feed Tools** | | | |
| | `npm run rss-test <url>` | Test and validate RSS feed URLs | RSS URL as argument |
| | `npm run google-rss` | Generate Google News RSS URLs | Interactive: country, language, topics/search |
| | `npm run poll [command]` | RSS feed polling and monitoring | `start`, `status`, `recent [N]`, `test` |
| **🏥 Feed Health Monitoring** | | | |
| | `npm run health check <feed-id>` | Comprehensive health analysis of a feed | `--detailed`, `--format=json\|table` |
| | `npm run health summary` | Health overview of all feeds | `--format=json\|table\|summary` |
| | `npm run health dashboard` | Live health monitoring dashboard | Real-time feed status |
| | `npm run health alerts` | Show active health alerts | `--severity=info\|warning\|error\|critical` |
| | `npm run health resolve <alert-id>` | Resolve specific health alert | Alert ID as argument |
| | `npm run health volume <feed-id>` | Analyze volume metrics for feed | `--days=N` for historical range |
| | `npm run health quality <feed-id>` | Analyze content quality metrics | Content completeness, readability |
| | `npm run health credibility <feed-id>` | Analyze feed credibility and authenticity | Author patterns, suspicious content |
| | `npm run health technical <feed-id>` | Technical performance analysis | Uptime, response times, errors |
| | `npm run health ranking` | Rank feeds by health score | Shows top and bottom performers |
| | `npm run health outliers` | Find feeds with unusual patterns | Statistical anomaly detection |
| | `npm run health monitor` | Start continuous health monitoring | Background monitoring with alerts |
| | `npm run health report` | Generate comprehensive health report | `--days=N` for report period |
| **🔧 Development Tools** | | | |
| | `npm run dev` | Development mode with file watching | Hot reload for development |
| | `npm run build` | Build TypeScript to JavaScript | Production build |
| | `npm run start` | Run compiled JavaScript application | Production start |
| | `npm run lint` | Run ESLint code quality checks | Code style and quality |
| | `npm run typecheck` | TypeScript type checking | Type validation without |
| | `npm run test` | Run test suite | Unit and integration tests |

### RSS Polling Commands Detail

The `npm run poll` command supports multiple sub-commands:

```bash
npm run poll                    # Start continuous RSS polling (default)
npm run poll start             # Same as above - start polling service
npm run poll status            # Show current polling status and database info
npm run poll recent [N]        # Show N most recent articles (default: 10)
npm run poll test              # Test RSS feed connection without polling
```

### Health Monitoring Commands Detail

The `npm run health` command provides comprehensive feed health analysis:

#### Core Health Commands
```bash
npm run health check us-tech-news              # Full health analysis
npm run health summary --format=json           # JSON summary of all feeds
npm run health dashboard                        # Interactive dashboard
```

#### Alert Management
```bash
npm run health alerts --severity=critical      # Show only critical alerts
npm run health resolve alert-12345            # Resolve specific alert
```

#### Specific Metric Analysis
```bash
npm run health volume us-tech --days=30       # 30-day volume analysis
npm run health quality finance-feed           # Content quality assessment
npm run health credibility news-source        # Authenticity analysis
npm run health technical rss-feed-1           # Performance metrics
```

#### Analysis & Reporting
```bash
npm run health ranking                         # Rank all feeds by health
npm run health outliers                        # Find statistically unusual feeds
npm run health report --days=14               # 14-day comprehensive report
npm run health monitor                         # Start continuous monitoring
```

### Configuration Options

Many commands accept additional options:

- `--format=table|json|summary` - Output format selection
- `--days=N` - Historical data range (default: 7)
- `--severity=level` - Filter alerts by severity level
- `--detailed` - Show additional detailed metrics
- `--resolve` - Auto-resolve alerts after displaying

### Architecture

The system follows a modular architecture designed for scalability:

- **Providers**: Abstracted API integrations (NewsAPI, future sources)
- **Services**: Core business logic with clear separation of concerns
- **CLI**: User-friendly interfaces for different workflows
- **Database**: SQLite for MVP, easily upgradeable to PostgreSQL
- **Types**: Comprehensive TypeScript types with Zod validation

## 🔮 Future Enhancements

- **Multiple News Sources**: RSS feeds, additional APIs
- **Web Scraping**: Custom scrapers for specific sources
- **Advanced AI**: Better summarization and content analysis
- **Email Delivery**: SMTP integration for newsletter distribution
- **Web Dashboard**: React-based management interface
- **Scheduling**: Automated newsletter generation
- **Analytics**: Click tracking and engagement metrics

## 🤝 Contributing

This is an MVP designed for rapid iteration. The codebase follows the two-model development approach outlined in CLAUDE-2.md for efficient scaling.

## 📄 License

MIT License - See LICENSE file for details.

---

**Built with TypeScript, SQLite, and modern Node.js practices for reliability and scalability.**