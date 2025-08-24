#!/usr/bin/env node

import { RSSPoller } from '../services/rss-poller.js';
import path from 'path';

/**
 * RSS Poller CLI - Monitor RSS feeds for new articles
 */

// Configuration - Edit these values as needed
const CONFIG = {
  // RSS feed URL to monitor
  feedUrl: 'https://techcrunch.com/feed/',
  
  // Polling interval in minutes
  intervalMinutes: 5,
  
  // Maximum articles to keep in database (older ones will be deleted)
  maxArticles: 1000,
  
  // Database file path (relative to project root)
  dbPath: path.join(process.cwd(), 'data', 'rss-poller.db')
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
    await poller.initialize();

    switch (command) {
      case 'start':
        await startPoller();
        break;
        
      case 'status':
        await showStatus();
        break;
        
      case 'recent':
        const limit = parseInt(args[1]) || 10;
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
  console.log(`📡 Feed: ${CONFIG.feedUrl}`);
  console.log(`⏰ Interval: ${CONFIG.intervalMinutes} minutes`);
  console.log(`💾 Database: ${CONFIG.dbPath}`);
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
  console.log(`📡 Feed URL: ${CONFIG.feedUrl}`);
  console.log(`📰 Total articles in DB: ${count}`);
  console.log(`💾 Database: ${CONFIG.dbPath}`);
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
  console.log('🧪 Testing RSS feed connection...\n');
  
  // Import and use the RSS test functionality
  const { RSSProvider } = await import('../providers/rss.js');
  const rssProvider = new RSSProvider();
  
  try {
    console.log('⏳ Validating feed...');
    const validation = await rssProvider.validateFeedUrl(CONFIG.feedUrl);
    
    if (!validation.isValid) {
      console.error(`❌ Invalid RSS feed: ${validation.error}`);
      return;
    }

    console.log('✅ Feed is valid!');
    
    const { articles, metadata } = await rssProvider.fetchFeed(CONFIG.feedUrl);
    
    console.log('\n📋 Feed Information:');
    console.log(`   Title: ${metadata.title || 'N/A'}`);
    console.log(`   Description: ${metadata.description || 'N/A'}`);
    console.log(`   Language: ${metadata.language || 'N/A'}`);
    console.log(`   Articles: ${articles.length}`);
    
    if (articles.length > 0) {
      console.log('\n📄 Sample Articles:');
      articles.slice(0, 3).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   📎 ${article.link}`);
        console.log(`   📅 ${article.pubDate || 'No date'}`);
      });
    }
    
    console.log('\n✅ Feed test completed successfully!');
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
  console.log(`  Feed URL: ${CONFIG.feedUrl}`);
  console.log(`  Interval: ${CONFIG.intervalMinutes} minutes`);
  console.log(`  Max Articles: ${CONFIG.maxArticles}`);
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