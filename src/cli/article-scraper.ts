#!/usr/bin/env node

import { ArticleLinkScraper } from '../services/article-link-scraper.js';
import path from 'path';

/**
 * Article Link Scraper CLI
 * Command-line interface for scraping article links from Google RSS feeds
 */

const DB_PATH = path.join(process.cwd(), 'data', 'google-rss.db');

interface CliOptions {
  feedId?: string;
  interval?: number;
  limit?: number;
  days?: number;
  validate?: boolean;
  cleanup?: boolean;
}

let scraper: ArticleLinkScraper | null = null;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  try {
    scraper = new ArticleLinkScraper(DB_PATH);
    await scraper.initialize();

    const options = parseOptions(args.slice(1));

    switch (command) {
      case 'start':
        await startContinuousScraping(options);
        break;
        
      case 'once':
        await runOnceScraping(options);
        break;
        
      case 'feed':
        await scrapeSingleFeed(options);
        break;
        
      case 'status':
        await showStatus(options);
        break;
        
      case 'pending':
        await showPendingArticles(options);
        break;
        
      case 'validate':
        await validateFeeds(options);
        break;
        
      case 'cleanup':
        await cleanupOldLinks(options);
        break;
        
      case 'stats':
        await showStatistics(options);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (scraper) await scraper.close();
  }
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--feed=')) {
      options.feedId = arg.split('=')[1] || undefined;
    } else if (arg.startsWith('--interval=')) {
      const intervalStr = arg.split('=')[1];
      options.interval = intervalStr ? parseInt(intervalStr) : undefined;
    } else if (arg.startsWith('--limit=')) {
      const limitStr = arg.split('=')[1];
      options.limit = limitStr ? parseInt(limitStr) : undefined;
    } else if (arg.startsWith('--days=')) {
      const daysStr = arg.split('=')[1];
      options.days = daysStr ? parseInt(daysStr) : undefined;
    } else if (arg === '--validate') {
      options.validate = true;
    } else if (arg === '--cleanup') {
      options.cleanup = true;
    } else if (!arg.startsWith('-') && !options.feedId) {
      options.feedId = arg;
    }
  }
  
  return options;
}

async function startContinuousScraping(options: CliOptions): Promise<void> {
  const interval = options.interval || 30; // Default 30 minutes
  
  console.log('🚀 Article Link Scraper');
  console.log('=====================');
  console.log(`📡 Scraping interval: ${interval} minutes`);
  console.log(`💾 Database: ${DB_PATH}\n`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (scraper) {
      await scraper.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal, shutting down...');
    if (scraper) {
      await scraper.close();
    }
    process.exit(0);
  });

  await scraper!.startContinuousScraping(interval);
  
  // Keep the process running
  process.stdin.resume();
}

async function runOnceScraping(options: CliOptions): Promise<void> {
  console.log('📡 Running one-time scraping of all active feeds...\n');
  
  await scraper!.scrapeAllFeeds();
  
  console.log('\n✅ One-time scraping completed');
}

async function scrapeSingleFeed(options: CliOptions): Promise<void> {
  if (!options.feedId) {
    console.error('❌ Feed ID required for single feed scraping');
    console.log('Usage: npm run scraper feed <feed-id>');
    return;
  }

  console.log(`📡 Scraping single feed: ${options.feedId}\n`);
  
  try {
    const newLinks = await scraper!.scrapeFeedById(options.feedId);
    console.log(`\n✅ Scraping completed. Found ${newLinks} new article links.`);
  } catch (error) {
    console.error(`❌ Failed to scrape feed: ${error instanceof Error ? error.message : error}`);
  }
}

async function showStatus(options: CliOptions): Promise<void> {
  console.log('📊 Article Scraper Status');
  console.log('========================\n');

  const stats = await scraper!.getScrapingStats();
  
  console.log(`🔄 Scraper running: ${stats.isRunning ? 'YES' : 'NO'}\n`);
  
  // Feed summary
  if (stats.feedSummary.length > 0) {
    console.log('📡 FEED SUMMARY');
    console.log('-'.repeat(80));
    console.log('Feed'.padEnd(25) + 'Mode'.padEnd(10) + 'Country'.padEnd(12) + 'Links'.padEnd(8) + 'Processed'.padEnd(12) + 'Completed');
    console.log('-'.repeat(80));
    
    stats.feedSummary.forEach((feed: any) => {
      const completionRate = feed.totalLinks > 0 ? 
        `${((feed.completedArticles / feed.totalLinks) * 100).toFixed(1)}%` : 'N/A';
      
      console.log(
        (feed.name || '').substring(0, 24).padEnd(25) +
        (feed.mode || '').padEnd(10) +
        (feed.country || '').padEnd(12) +
        (feed.totalLinks || 0).toString().padEnd(8) +
        (feed.processedLinks || 0).toString().padEnd(12) +
        completionRate
      );
    });
    
    const totals = stats.feedSummary.reduce((acc: any, feed: any) => ({
      totalLinks: acc.totalLinks + (feed.totalLinks || 0),
      processedLinks: acc.processedLinks + (feed.processedLinks || 0),
      completedArticles: acc.completedArticles + (feed.completedArticles || 0)
    }), { totalLinks: 0, processedLinks: 0, completedArticles: 0 });
    
    console.log('-'.repeat(80));
    console.log(`TOTALS: ${totals.totalLinks} links, ${totals.processedLinks} processed, ${totals.completedArticles} completed`);
  } else {
    console.log('📭 No feeds found. Add feeds using: npm run google-rss');
  }

  // Weekly overview
  if (stats.weeklyOverview.length > 0) {
    console.log('\n📈 WEEKLY ACTIVITY (Last 7 Days)');
    console.log('-'.repeat(60));
    console.log('Date'.padEnd(12) + 'Feeds'.padEnd(8) + 'Links'.padEnd(8) + 'Extracted'.padEnd(12) + 'Summarized'.padEnd(12) + 'Errors');
    console.log('-'.repeat(60));
    
    stats.weeklyOverview.forEach((day: any) => {
      console.log(
        (day.date || '').padEnd(12) +
        (day.activeFeeds || 0).toString().padEnd(8) +
        (day.totalLinksScraped || 0).toString().padEnd(8) +
        (day.totalExtracted || 0).toString().padEnd(12) +
        (day.totalSummarized || 0).toString().padEnd(12) +
        (day.totalErrors || 0).toString()
      );
    });
  }
}

async function showPendingArticles(options: CliOptions): Promise<void> {
  const limit = options.limit || 20;
  
  console.log(`📝 Pending Article Links (showing up to ${limit})`);
  console.log('='.repeat(50 + limit.toString().length));

  const pendingLinks = await scraper!.getPendingArticles(limit);
  
  if (pendingLinks.length === 0) {
    console.log('✅ No pending articles found. All articles have been processed!');
    return;
  }

  console.log(`Found ${pendingLinks.length} pending articles:\n`);
  
  pendingLinks.forEach((link, index) => {
    const scrapedDate = new Date(link.scrapedAt).toLocaleDateString();
    console.log(`${index + 1}. ${link.title}`);
    console.log(`   🔗 ${link.link}`);
    console.log(`   📅 Scraped: ${scrapedDate} | Stage: ${link.processingStage}`);
    console.log(`   🆔 Link ID: ${link.id}\n`);
  });
  
  console.log(`💡 Process these articles with: npm run process articles`);
}

async function validateFeeds(options: CliOptions): Promise<void> {
  console.log('🔍 Validating RSS feeds...\n');
  
  await scraper!.validateFeeds();
  
  console.log('\n✅ Feed validation completed');
}

async function cleanupOldLinks(options: CliOptions): Promise<void> {
  const days = options.days || 30;
  
  console.log(`🗑️  Cleaning up processed article links older than ${days} days...\n`);
  
  try {
    const deletedCount = await scraper!.cleanupOldLinks(days);
    console.log(`✅ Cleanup completed. Removed ${deletedCount} old article links.`);
  } catch (error) {
    console.error(`❌ Cleanup failed: ${error instanceof Error ? error.message : error}`);
  }
}

async function showStatistics(options: CliOptions): Promise<void> {
  console.log('📈 Article Processing Statistics');
  console.log('==============================\n');

  const stats = await scraper!.getScrapingStats();
  
  if (stats.feedSummary.length === 0) {
    console.log('📭 No feeds found. Add feeds using: npm run google-rss');
    return;
  }

  // Overall statistics
  const totals = stats.feedSummary.reduce((acc: any, feed: any) => ({
    feeds: acc.feeds + 1,
    totalLinks: acc.totalLinks + (feed.totalLinks || 0),
    processedLinks: acc.processedLinks + (feed.processedLinks || 0),
    completedArticles: acc.completedArticles + (feed.completedArticles || 0),
    highQualityArticles: acc.highQualityArticles + (feed.highQualityArticles || 0),
    avgWordCount: acc.avgWordCount + (feed.avgWordCount || 0)
  }), { feeds: 0, totalLinks: 0, processedLinks: 0, completedArticles: 0, highQualityArticles: 0, avgWordCount: 0 });

  totals.avgWordCount = totals.avgWordCount / (totals.feeds || 1);

  console.log('📊 OVERALL STATISTICS');
  console.log(`Total feeds: ${totals.feeds}`);
  console.log(`Total article links: ${totals.totalLinks}`);
  console.log(`Processed links: ${totals.processedLinks} (${((totals.processedLinks / (totals.totalLinks || 1)) * 100).toFixed(1)}%)`);
  console.log(`Completed articles: ${totals.completedArticles}`);
  console.log(`High quality articles: ${totals.highQualityArticles}`);
  console.log(`Average word count: ${totals.avgWordCount.toFixed(0)} words`);

  // Top performing feeds
  const topFeeds = stats.feedSummary
    .filter((f: any) => f.completedArticles > 0)
    .sort((a: any, b: any) => b.completedArticles - a.completedArticles)
    .slice(0, 5);

  if (topFeeds.length > 0) {
    console.log('\n🏆 TOP PERFORMING FEEDS');
    topFeeds.forEach((feed: any, index: number) => {
      console.log(`${index + 1}. ${feed.name} - ${feed.completedArticles} articles completed`);
    });
  }

  // Processing pipeline status
  const pendingCount = await scraper!.getPendingArticles(1000);
  const processingRate = totals.totalLinks > 0 ? 
    ((totals.totalLinks - pendingCount.length) / totals.totalLinks * 100).toFixed(1) : '0.0';

  console.log('\n⚙️  PROCESSING PIPELINE');
  console.log(`Articles in queue: ${pendingCount.length}`);
  console.log(`Processing completion: ${processingRate}%`);
  
  if (pendingCount.length > 0) {
    console.log('\n💡 Process pending articles with:');
    console.log('   npm run process articles');
  }
}

function showHelp(): void {
  console.log('📡 Article Link Scraper CLI');
  console.log('===========================\n');
  
  console.log('COMMANDS:');
  console.log('  start                 Start continuous scraping of all active feeds');
  console.log('  once                  Run one-time scraping of all active feeds');
  console.log('  feed <feed-id>        Scrape a specific feed by ID');
  console.log('  status                Show scraper status and feed summary');
  console.log('  pending               Show pending article links awaiting processing');
  console.log('  validate              Validate all RSS feeds');
  console.log('  cleanup               Clean up old processed article links');
  console.log('  stats                 Show detailed processing statistics');
  console.log('  help                  Show this help message\n');
  
  console.log('OPTIONS:');
  console.log('  --interval=<minutes>  Scraping interval for continuous mode (default: 30)');
  console.log('  --feed=<id>          Specify feed ID for single feed operations');
  console.log('  --limit=<number>     Limit number of results shown (default varies by command)');
  console.log('  --days=<number>      Number of days for cleanup operations (default: 30)');
  console.log('  --validate           Validate feeds during operation');
  console.log('  --cleanup            Clean up old links after operation\n');
  
  console.log('EXAMPLES:');
  console.log('  npm run scraper start --interval=15      # Start with 15-minute intervals');
  console.log('  npm run scraper once                     # One-time scrape all feeds');
  console.log('  npm run scraper feed abc123              # Scrape specific feed');
  console.log('  npm run scraper status                   # Show current status');
  console.log('  npm run scraper pending --limit=50       # Show 50 pending articles');
  console.log('  npm run scraper cleanup --days=14        # Clean up links older than 14 days');
  console.log('  npm run scraper stats                    # Show processing statistics\n');
  
  console.log('💡 WORKFLOW:');
  console.log('1. Add RSS feeds: npm run google-rss');
  console.log('2. Start scraper: npm run scraper start');
  console.log('3. Process articles: npm run process articles');
  console.log('4. Monitor status: npm run scraper status');
}

// Run main function
main().catch(console.error);