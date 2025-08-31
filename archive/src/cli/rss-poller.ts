#!/usr/bin/env node

import { RSSPoller } from '../services/rss-poller.js';
import path from 'path';

/**
 * RSS Poller CLI - Monitor RSS feeds for new articles
 */

// Configuration - Edit these values as needed
const CONFIG = {
  // Polling interval in minutes
  intervalMinutes: 5,
  
  // Maximum articles to keep in database (older ones will be deleted)
  maxArticles: 1000,
  
  // Skip articles older than this many days
  maxArticleAgeDays: 7,
  
  // Database file path (relative to project root)
  dbPath: path.join(process.cwd(), 'data', 'rss-poller.db'),
  
  // Main database path with RSS feeds
  mainDbPath: path.join(process.cwd(), 'data', 'articles.db'),
  
  // Enable advanced features
  enableHealthTracking: true,
  enableContentExtraction: true,
  enableLanguageDetection: true,
  
  // Admin notification email (optional)
  adminNotificationEmail: process.env.ADMIN_EMAIL || undefined
};

let poller: RSSPoller | null = null;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  try {
    poller = new RSSPoller(CONFIG);
    await poller!.initialize();

    switch (command) {
      case 'start':
        await startPoller();
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'recent':
        const limit = parseInt(args[1] || '10') || 10;
        await showRecentArticles(limit);
        break;
        
      case 'test':
        await testFeed();
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function startPoller(): Promise<void> {
  console.log('🌍 RSS Feed Poller');
  console.log('================');
  console.log(`📡 Mode: All database feeds`);
  console.log(`⏰ Interval: ${CONFIG.intervalMinutes} minutes`);
  console.log(`💾 Database: ${CONFIG.dbPath}`);
  console.log(`🗃️  Main DB: ${CONFIG.mainDbPath}`);
  console.log(`📊 Max articles: ${CONFIG.maxArticles}`);
  console.log('\n💡 Press Ctrl+C to stop\n');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (poller) {
      await poller.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal, shutting down...');
    if (poller) {
      await poller.close();
    }
    process.exit(0);
  });

  await poller!.start();
  
  // Keep the process running
  process.stdin.resume();
}

async function showStatus(): Promise<void> {
  const count = await poller!.getArticleCount();
  console.log('📊 RSS Poller Status');
  console.log('==================');
  console.log(`📡 Mode: All database feeds`);
  console.log(`📰 Total articles in DB: ${count}`);
  console.log(`💾 Database: ${CONFIG.dbPath}`);
  console.log(`🗃️  Main DB: ${CONFIG.mainDbPath}`);
  console.log(`📊 Max articles limit: ${CONFIG.maxArticles}`);
}

async function showRecentArticles(limit: number): Promise<void> {
  const articles = await poller!.getRecentArticles(limit);
  
  console.log(`📰 Recent Articles (last ${limit})`);
  console.log('================================');
  
  if (articles.length === 0) {
    console.log('No articles found in database.');
    return;
  }

  articles.forEach((article, index) => {
    const date = new Date(article.createdAt).toLocaleString();
    console.log(`\n${index + 1}. ${article.title}`);
    console.log(`   📎 ${article.link}`);
    console.log(`   📅 ${date}`);
  });
}

async function testFeed(): Promise<void> {
  console.log('🧪 Testing database RSS feeds...\n');
  
  // Import database service
  const { DatabaseService } = await import('../services/database.js');
  const database = new DatabaseService();
  
  try {
    // Get all RSS feeds from database
    const feeds = await database.getRSSFeeds(true); // activeOnly = true
    const activeFeeds = feeds;
    
    if (activeFeeds.length === 0) {
      console.log('📭 No active RSS feeds found in database');
      console.log('💡 Use the fetch CLI to add RSS feeds first');
      return;
    }

    console.log(`🔍 Testing ${activeFeeds.length} active feeds...\n`);
    
    const { RSSProvider } = await import('../providers/rss.js');
    const rssProvider = new RSSProvider();
    
    for (const feed of activeFeeds) {
      console.log(`📡 Testing: ${feed.name} (${feed.url})`);
      
      const validation = await rssProvider.validateFeedUrl(feed.url);
      if (!validation.isValid) {
        console.error(`   ❌ Invalid: ${validation.error}`);
        continue;
      }
      
      const { articles, metadata } = await rssProvider.fetchFeed(feed.url);
      console.log(`   ✅ Valid - ${articles.length} articles available`);
      
      if (articles.length > 0) {
        console.log(`   📄 Sample: ${articles[0].title}`);
      }
    }
    
    console.log('\n✅ All feed tests completed!');
  } catch (error) {
    console.error('❌ Feed test failed:', error instanceof Error ? error.message : error);
  }
}

function showHelp(): void {
  console.log('🌍 RSS Feed Poller CLI');
  console.log('====================');
  console.log('');
  console.log('Commands:');
  console.log('  start              Start monitoring the RSS feed (default)');
  console.log('  status             Show poller status and database info');
  console.log('  recent [N]         Show N recent articles (default: 10)');
  console.log('  test               Test RSS feed connection');
  console.log('  help               Show this help message');
  console.log('');
  console.log('Configuration:');
  console.log(`  Mode: All database feeds`);
  console.log(`  Interval: ${CONFIG.intervalMinutes} minutes`);
  console.log(`  Max Articles: ${CONFIG.maxArticles}`);
  console.log(`  Max Article Age: ${CONFIG.maxArticleAgeDays} days`);
  console.log(`  Content Extraction: ${CONFIG.enableContentExtraction ? 'Enabled' : 'Disabled'}`);
  console.log(`  Health Tracking: ${CONFIG.enableHealthTracking ? 'Enabled' : 'Disabled'}`);
  console.log(`  Language Detection: ${CONFIG.enableLanguageDetection ? 'Enabled' : 'Disabled'}`);
  console.log('');
  console.log('Examples:');
  console.log('  npm run poll           # Start polling');
  console.log('  npm run poll status    # Show status');
  console.log('  npm run poll recent 5  # Show 5 recent articles');
  console.log('  npm run poll test      # Test feed connection');
  console.log('');
  console.log('💡 Edit the CONFIG object in this file to change settings');
}

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(CONFIG.dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Run main function
main().catch(console.error);