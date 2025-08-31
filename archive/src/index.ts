#!/usr/bin/env node

/**
 * GlobalNews Letter - Main Entry Point
 * 
 * A multi-language news aggregation and curation system that:
 * - Fetches articles from NewsAPI for finance and tech categories
 * - Provides AI summarization via local LLM integration
 * - Supports English, Spanish, and Arabic languages
 * - Generates JSON newsletters from selected articles
 * - Includes CLI tools for article management
 */

import { ArticleService } from './services/articles.js';
import { NewsletterService } from './services/newsletter.js';

/**
 * Main application class
 */
export class GlobalNewsLetter {
  public articleService: ArticleService;
  public newsletterService: NewsletterService;

  constructor() {
    this.articleService = new ArticleService();
    this.newsletterService = new NewsletterService();
  }

  /**
   * Test all services
   */
  async testServices(): Promise<void> {
    console.log('🌍 GlobalNews Letter - Service Status Check\n');
    
    try {
      const status = await this.articleService.testServices();
      
      console.log('Service Status:');
      console.log(`  NewsAPI: ${status.newsAPI ? '✅ Connected' : '❌ Failed'}`);
      console.log(`  LLM Service: ${status.llm ? '✅ Connected' : '⚠️  Unavailable (will use fallback summaries)'}`);
      console.log(`  RSS Feeds: ${status.rssFeeds} active feeds`);
      
      if (!status.newsAPI) {
        console.log('\n❌ NewsAPI connection failed. Please check:');
        console.log('  - Your API key in .local.env');
        console.log('  - Internet connection');
        console.log('  - API rate limits\n');
      }

      if (!status.llm) {
        console.log('\n⚠️  LLM service unavailable. Please check:');
        console.log('  - Ollama is running on http://localhost:11434');
        console.log('  - Model is available (codellama:7b)');
        console.log('  - Or update LLM_API_URL in .local.env\n');
      }

      if (status.rssFeeds === 0) {
        console.log('\n📡 No RSS feeds configured. Use the fetch CLI to:');
        console.log('  - Import common RSS feeds');
        console.log('  - Add custom RSS feeds\n');
      }

      const stats = await this.articleService.getArticleStats();
      console.log('Database Statistics:');
      console.log(`  Finance articles: ${stats.finance}`);
      console.log(`  Tech articles: ${stats.tech}`);
      console.log(`  Total: ${stats.finance + stats.tech}`);

      const selectedArticles = await this.articleService.getSelectedArticles();
      console.log(`  Selected for newsletter: ${selectedArticles.length}`);

    } catch (error) {
      console.error('Error testing services:', error);
    } finally {
      this.articleService.close();
    }
  }

  /**
   * Cleanup resources
   */
  close(): void {
    this.articleService.close();
  }
}

// CLI command routing
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    showHelp();
    return;
  }

  switch (command) {
    case 'test':
      const app = new GlobalNewsLetter();
      await app.testServices();
      break;
    
    case 'fetch':
      console.log('Use: npm run fetch (or npx tsx src/cli/fetch.ts)');
      break;
    
    case 'generate':
      console.log('Use: npm run generate (or npx tsx src/cli/generate.ts)');
      break;
    
    default:
      console.log(`Unknown command: ${command}`);
      showHelp();
  }
}

function showHelp() {
  console.log(`
🌍 GlobalNews Letter - Multi-language News Aggregation System

USAGE:
  npm run dev                     # Test services and show status
  npm run fetch                   # Interactive article fetching
  npm run generate                # Interactive newsletter generation

COMMANDS:
  npm run dev test                # Test all services
  npx tsx src/cli/fetch.ts        # Direct access to fetch CLI
  npx tsx src/cli/generate.ts     # Direct access to generate CLI

SETUP:
  1. Install dependencies: npm install
  2. Ensure .local.env has NEWSAPI_API_KEY
  3. Optional: Start Ollama for AI summaries
  4. Run: npm run fetch to get articles
  5. Run: npm run generate to create newsletters

FEATURES:
  ✅ NewsAPI integration (finance & tech categories)
  ✅ Local LLM integration (Ollama) for summaries
  ✅ Multi-language support (English, Spanish, Arabic)
  ✅ SQLite database for article storage
  ✅ Interactive CLI for article selection
  ✅ JSON newsletter generation
  ✅ Translation support
  ✅ Search and filtering

OUTPUT:
  - Articles stored in SQLite database (./data/articles.db)
  - Newsletters saved as JSON files (./output/)

For more information, see the project documentation.
`);
}

// Run main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}