#!/usr/bin/env node
import { EnhancedDatabaseService } from '../services/enhanced-database.js';
import { EnhancedRSSDatabaseManager } from '../database/enhanced-rss-schema.js';
import { DatabaseService } from '../services/database.js';
import fs from 'fs';
import path from 'path';

/**
 * Database Initialization Script
 * Initializes both legacy and enhanced database schemas
 */

async function initializeDatabase() {
  console.log('🚀 Initializing GlobalNews Letter Database...\n');

  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ Created data directory');
    }

    // Initialize legacy database (for backward compatibility)
    console.log('📊 Initializing legacy database schema...');
    const legacyDb = new DatabaseService();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Allow initialization
    console.log('✅ Legacy database initialized');

    // Initialize enhanced database
    console.log('🔧 Initializing enhanced database schema...');
    const enhancedDb = new EnhancedDatabaseService('data/enhanced-rss.db');
    await enhancedDb.initialize();
    console.log('✅ Enhanced database initialized');

    // Initialize Google RSS database
    console.log('🌐 Initializing Google RSS database schema...');
    const googleDb = new EnhancedRSSDatabaseManager('data/google-rss.db');
    await googleDb.initialize();
    console.log('✅ Google RSS database initialized');

    // Create sample data if databases are empty
    console.log('\n📝 Checking for sample data...');
    await createSampleData(enhancedDb);

    console.log('\n🎉 Database initialization complete!');
    console.log('\n📍 Database files created:');
    console.log('   - data/news.db (legacy)');
    console.log('   - data/enhanced-rss.db (main)');
    console.log('   - data/google-rss.db (google feeds)');

    console.log('\n🔗 Next steps:');
    console.log('   1. Start the API server: npm run dev');
    console.log('   2. Add RSS feeds: See WIKI.md for examples');
    console.log('   3. Monitor health: http://localhost:3333/api/v2/health');

    // Close database connections
    await enhancedDb.close();
    await googleDb.close();
    legacyDb.close();

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function createSampleData(db: EnhancedDatabaseService) {
  try {
    // Check if we already have feed sources
    const existingSources = await db.getFeedSources({ activeOnly: true });
    if (existingSources.length > 0) {
      console.log(`✅ Found ${existingSources.length} existing feed sources`);
      return;
    }

    console.log('📋 Creating sample feed sources and instances...');

    // Sample feed sources
    const sampleSources = [
      {
        id: 'reuters-finance-001',
        name: 'Reuters Finance',
        base_url: 'https://reuters.com',
        provider_type: 'rss' as const,
        source_language: 'en' as const,
        primary_region: 'us',
        content_category: 'finance' as const,
        content_type: 'breaking' as const,
        is_active: true,
        quality_score: 0.9
      },
      {
        id: 'techcrunch-001',
        name: 'TechCrunch',
        base_url: 'https://techcrunch.com',
        provider_type: 'rss' as const,
        source_language: 'en' as const,
        primary_region: 'us',
        content_category: 'tech' as const,
        content_type: 'daily' as const,
        is_active: true,
        quality_score: 0.85
      },
      {
        id: 'elpais-salud-001',
        name: 'El País Salud',
        base_url: 'https://elpais.com',
        provider_type: 'rss' as const,
        source_language: 'es' as const,
        primary_region: 'es',
        content_category: 'health' as const,
        content_type: 'daily' as const,
        is_active: true,
        quality_score: 0.8
      }
    ];

    // Create sources
    for (const source of sampleSources) {
      await db.saveFeedSource(source);
    }

    // Sample feed instances
    const sampleInstances = [
      {
        id: 'reuters-business-feed',
        source_id: 'reuters-finance-001',
        instance_name: 'Reuters Business News',
        feed_url: 'https://feeds.reuters.com/reuters/businessNews',
        refresh_tier: 'frequent' as const,
        base_refresh_minutes: 30,
        adaptive_refresh: true,
        consecutive_failures: 0,
        avg_articles_per_fetch: 15,
        reliability_score: 0.95,
        is_active: true
      },
      {
        id: 'techcrunch-main-feed',
        source_id: 'techcrunch-001',
        instance_name: 'TechCrunch Main Feed',
        feed_url: 'https://techcrunch.com/feed/',
        refresh_tier: 'standard' as const,
        base_refresh_minutes: 60,
        adaptive_refresh: true,
        consecutive_failures: 0,
        avg_articles_per_fetch: 12,
        reliability_score: 0.9,
        is_active: true
      },
      {
        id: 'elpais-salud-feed',
        source_id: 'elpais-salud-001',
        instance_name: 'El País - Sección Salud',
        feed_url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/salud',
        refresh_tier: 'standard' as const,
        base_refresh_minutes: 90,
        adaptive_refresh: true,
        consecutive_failures: 0,
        avg_articles_per_fetch: 8,
        reliability_score: 0.85,
        is_active: true
      }
    ];

    // Create instances
    for (const instance of sampleInstances) {
      await db.saveFeedInstance(instance);
    }

    console.log(`✅ Created ${sampleSources.length} sample feed sources`);
    console.log(`✅ Created ${sampleInstances.length} sample feed instances`);
    console.log('\n📋 Sample feeds added:');
    sampleSources.forEach((source, index) => {
      const instance = sampleInstances[index];
      console.log(`   ${index + 1}. ${source.name} (${source.source_language})`);
      console.log(`      Category: ${source.content_category}`);
      console.log(`      Tier: ${instance.refresh_tier}`);
      console.log(`      URL: ${instance.feed_url}`);
    });

  } catch (error) {
    console.error('⚠️ Warning: Could not create sample data:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase().catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
}