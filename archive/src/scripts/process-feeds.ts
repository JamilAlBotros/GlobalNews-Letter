#!/usr/bin/env tsx

import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../services/database.js';
import type { Category, Language, RSSFeed } from '../types/index.js';

interface FeedToProcess {
  name: string;
  url: string;
  category: Category;
  language: Language;
  description?: string;
}

/**
 * Parse feeds from the RSS file and categorize them
 */
function parseFeeds(): FeedToProcess[] {
  const feeds: FeedToProcess[] = [
    // News aggregators and general news
    {
      name: "Al Jazeera",
      url: "https://www.aljazeera.com/xml/rss/all.xml",
      category: "finance",
      language: "english",
      description: "Al Jazeera international news coverage"
    },
    {
      name: "Yahoo News",
      url: "https://www.yahoo.com/news/rss",
      category: "tech",
      language: "english",
      description: "Yahoo News general coverage"
    },

    // Spanish language feeds
    {
      name: "El País - Business",
      url: "https://feeds.elpais.com/mrss-s/list/ep/site/elpais.com/section/economia/subsection/negocios",
      category: "finance",
      language: "spanish",
      description: "El País business and economics news"
    },
    {
      name: "El País - Argentina",
      url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/argentina/portada",
      category: "finance",
      language: "spanish",
      description: "El País Argentina news coverage"
    },
    {
      name: "El País - Technology",
      url: "https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/tecnologia/portada",
      category: "tech",
      language: "spanish",
      description: "El País technology news"
    },
    {
      name: "Clarín",
      url: "https://www.clarin.com/rss/lo-ultimo",
      category: "finance",
      language: "spanish",
      description: "Clarín latest news from Argentina"
    },

    // French language feeds
    {
      name: "Le Monde - Most Read",
      url: "https://www.lemonde.fr/rss/plus-lus.xml",
      category: "finance",
      language: "english", // Often has English content
      description: "Le Monde most read articles"
    },

    // Japanese feeds
    {
      name: "Asahi Shimbun - Business",
      url: "https://www.asahi.com/rss/asahi/business.rdf",
      category: "finance",
      language: "english", // International section often in English
      description: "Asahi Shimbun business news"
    },
    {
      name: "Asahi Shimbun - Science",
      url: "https://www.asahi.com/rss/asahi/science.rdf",
      category: "tech",
      language: "english",
      description: "Asahi Shimbun science and technology news"
    },

    // Persian/Iranian feeds
    {
      name: "Eghtesad Moaser",
      url: "https://eghtesademoaser.ir/fa/rss/economy",
      category: "finance",
      language: "english", // Will be translated
      description: "Iranian economic news"
    },

    // Arabic feeds
    {
      name: "Al Arabiya - Saudi Today",
      url: "https://www.alarabiya.net/feed/rss2/ar/saudi-today.xml",
      category: "finance",
      language: "arabic",
      description: "Al Arabiya Saudi Arabia news"
    },
    {
      name: "Al Arabiya - Technology",
      url: "https://www.alarabiya.net/feed/rss2/ar/technology.xml",
      category: "tech",
      language: "arabic",
      description: "Al Arabiya technology news"
    },

    // Financial feeds
    {
      name: "B3 Bora Investir",
      url: "https://borainvestir.b3.com.br/noticias/feed/",
      category: "finance",
      language: "english", // Brazilian Portuguese, will be translated
      description: "B3 Brazilian stock exchange news"
    }
  ];

  return feeds;
}

/**
 * Main processing function
 */
async function main() {
  console.log('🚀 Starting RSS feed processing...');
  
  // Initialize database service only
  const database = new DatabaseService();

  try {
    // Parse feeds from our curated list
    const feedsToProcess = parseFeeds();
    console.log(`📋 Found ${feedsToProcess.length} feeds to process`);

    let successCount = 0;
    let errorCount = 0;

    // Process each feed
    for (const feedInfo of feedsToProcess) {
      try {
        console.log(`\n📡 Processing: ${feedInfo.name}`);
        console.log(`   URL: ${feedInfo.url}`);
        console.log(`   Category: ${feedInfo.category}`);
        console.log(`   Language: ${feedInfo.language}`);

        // Check if feed already exists
        if (await database.rssFeedExists(feedInfo.url)) {
          console.log(`   ⚠️  Feed already exists, skipping...`);
          continue;
        }

        // Create RSS feed object
        const feed: RSSFeed = {
          id: randomUUID(),
          name: feedInfo.name,
          url: feedInfo.url,
          category: feedInfo.category,
          language: feedInfo.language,
          isActive: true,
          lastFetched: null,
          createdAt: new Date(),
          description: feedInfo.description
        };

        // Add the feed directly to database
        await database.saveRSSFeed(feed);

        console.log(`   ✅ Successfully added feed: ${feed.id}`);
        successCount++;

        // Small delay to be respectful to servers
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`   ❌ Failed to add ${feedInfo.name}:`, error);
        errorCount++;
      }
    }

    // Show final statistics
    console.log('\n📊 Processing Summary:');
    console.log(`   ✅ Successfully added: ${successCount} feeds`);
    console.log(`   ❌ Failed to add: ${errorCount} feeds`);
    console.log(`   📊 Total processed: ${feedsToProcess.length} feeds`);

    // Show database statistics
    const stats = await database.getRSSFeedStats();
    console.log('\n📈 Database Statistics:');
    console.log(`   Total feeds: ${stats.total}`);
    console.log(`   Active feeds: ${stats.active}`);
    console.log(`   Finance feeds: ${stats.byCategory.finance}`);
    console.log(`   Tech feeds: ${stats.byCategory.tech}`);

  } catch (error) {
    console.error('❌ Fatal error during processing:', error);
    process.exit(1);
  } finally {
    // Clean up
    database.close();
  }

  console.log('\n🎉 RSS feed processing completed!');
}

// Run the script
if (import.meta.url.includes('process-feeds.ts')) {
  main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { parseFeeds, main };