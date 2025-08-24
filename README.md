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

### Scripts

```bash
npm run dev          # Development mode with watch
npm run build        # Build TypeScript
npm run start        # Run built application
npm run lint         # ESLint
npm run typecheck    # TypeScript checking
npm run test         # Run tests
npm run fetch        # Article fetching CLI
npm run generate     # Newsletter generation CLI
```

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