#!/usr/bin/env node

import { RSSProvider } from '../providers/rss.js';

/**
 * Simple RSS feed tester CLI
 */
async function testRSSFeed() {
  const args = process.argv.slice(2);
  const feedUrl = args[0];

  if (!feedUrl) {
    console.log('\n🔍 RSS Feed Tester\n');
    console.log('Usage: npm run rss-test <feed-url>');
    console.log('\nExample:');
    console.log('  npm run rss-test https://techcrunch.com/feed/');
    console.log('  npm run rss-test https://feeds.reuters.com/reuters/businessNews');
    return;
  }

  console.log(`\n🔍 Testing RSS Feed: ${feedUrl}\n`);

  const rssProvider = new RSSProvider();

  try {
    console.log('⏳ Validating feed...');
    const validation = await rssProvider.validateFeedUrl(feedUrl);
    
    if (!validation.isValid) {
      console.error(`❌ Invalid RSS feed: ${validation.error}`);
      return;
    }

    console.log('✅ Feed is valid!\n');

    console.log('📡 Fetching articles...');
    const { articles, metadata } = await rssProvider.fetchFeed(feedUrl);

    console.log('\n📋 Feed Information:');
    console.log(`   Title: ${metadata.title || 'N/A'}`);
    console.log(`   Description: ${metadata.description || 'N/A'}`);
    console.log(`   Language: ${metadata.language || 'N/A'}`);
    console.log(`   Last Build: ${metadata.lastBuildDate || 'N/A'}`);
    console.log(`   Generator: ${metadata.generator || 'N/A'}`);

    console.log(`\n📰 Articles Found: ${articles.length}`);
    
    if (articles.length > 0) {
      console.log('\n📄 Recent Articles (showing first 5):');
      articles.slice(0, 5).forEach((article, index) => {
        console.log(`\n${index + 1}. ${article.title}`);
        console.log(`   Author: ${article.author || 'Unknown'}`);
        console.log(`   Date: ${article.pubDate || 'No date'}`);
        console.log(`   Link: ${article.link}`);
        if (article.categories && article.categories.length > 0) {
          console.log(`   Categories: ${article.categories.join(', ')}`);
        }
      });

      // Auto-detect category and language
      const detectedCategory = rssProvider.detectCategoryFromFeed(metadata, articles);
      const detectedLanguage = rssProvider.detectLanguageFromFeed(metadata, articles);
      
      console.log('\n🤖 Auto-Detection:');
      console.log(`   Detected Category: ${detectedCategory}`);
      console.log(`   Detected Language: ${detectedLanguage}`);
    }

    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error(`❌ Error testing RSS feed:`, error instanceof Error ? error.message : error);
  }
}

// Run the test
testRSSFeed().catch(console.error);