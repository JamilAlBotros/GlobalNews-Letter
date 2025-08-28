#!/usr/bin/env node
import { EnhancedRSSDatabaseManager } from '../database/enhanced-rss-schema.js';
import { DatabaseService } from '../services/database.js';
import fs from 'fs';
import path from 'path';

/**
 * Simple Database Initialization
 * Creates the database tables without complex services
 */

async function simpleInitialization() {
  console.log('🚀 Simple Database Initialization...\n');

  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ Created data directory');
    }

    // Initialize legacy database
    console.log('📊 Initializing legacy database...');
    const legacyDb = new DatabaseService();
    // Give it time to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Legacy database initialized');

    // Initialize enhanced database
    console.log('🔧 Initializing enhanced database...');
    const enhancedDb = new EnhancedRSSDatabaseManager('data/enhanced-rss.db');
    await enhancedDb.initialize();
    console.log('✅ Enhanced database initialized');

    // Initialize Google RSS database
    console.log('🌐 Initializing Google RSS database...');
    const googleDb = new EnhancedRSSDatabaseManager('data/google-rss.db');
    await googleDb.initialize();
    console.log('✅ Google RSS database initialized');

    // Create sample feed sources using raw SQL
    console.log('\n📝 Creating sample feed sources...');
    await createSampleFeeds(enhancedDb);

    console.log('\n🎉 Database initialization complete!');
    console.log('\n📍 Database files created:');
    console.log('   - data/news.db (legacy)');
    console.log('   - data/enhanced-rss.db (main)'); 
    console.log('   - data/google-rss.db (google feeds)');

    console.log('\n🔗 Next steps:');
    console.log('   1. Start the API server: npm run dev');
    console.log('   2. Check database: npm run db:list');
    console.log('   3. Add more feeds via API or scripts');

    // Close connections
    await enhancedDb.close();
    await googleDb.close();
    legacyDb.close();

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function createSampleFeeds(db: EnhancedRSSDatabaseManager): Promise<void> {
  try {
    // Use the raw database connection to insert sample data
    const dbInstance = (db as any).db;
    
    const sampleSources = [
      {
        id: 'reuters-finance-001',
        name: 'Reuters Finance',
        base_url: 'https://reuters.com',
        provider_type: 'rss',
        source_language: 'en',
        primary_region: 'us',
        content_category: 'finance',
        content_type: 'breaking',
        is_active: 1,
        quality_score: 0.9
      },
      {
        id: 'techcrunch-001', 
        name: 'TechCrunch',
        base_url: 'https://techcrunch.com',
        provider_type: 'rss',
        source_language: 'en',
        primary_region: 'us',
        content_category: 'tech',
        content_type: 'daily',
        is_active: 1,
        quality_score: 0.85
      },
      {
        id: 'elpais-salud-001',
        name: 'El País Salud',
        base_url: 'https://elpais.com',
        provider_type: 'rss',
        source_language: 'es',
        primary_region: 'es',
        content_category: 'health',
        content_type: 'daily',
        is_active: 1,
        quality_score: 0.8
      }
    ];

    const sampleInstances = [
      {
        id: 'reuters-business-feed',
        source_id: 'reuters-finance-001',
        instance_name: 'Reuters Business News',
        feed_url: 'https://feeds.reuters.com/reuters/businessNews',
        refresh_tier: 'frequent',
        base_refresh_minutes: 30,
        adaptive_refresh: 1,
        consecutive_failures: 0,
        avg_articles_per_fetch: 15,
        reliability_score: 0.95,
        is_active: 1
      },
      {
        id: 'techcrunch-main-feed',
        source_id: 'techcrunch-001',
        instance_name: 'TechCrunch Main Feed',
        feed_url: 'https://techcrunch.com/feed/',
        refresh_tier: 'standard',
        base_refresh_minutes: 60,
        adaptive_refresh: 1,
        consecutive_failures: 0,
        avg_articles_per_fetch: 12,
        reliability_score: 0.9,
        is_active: 1
      },
      {
        id: 'elpais-salud-feed',
        source_id: 'elpais-salud-001',
        instance_name: 'El País - Sección Salud',
        feed_url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/salud',
        refresh_tier: 'standard',
        base_refresh_minutes: 90,
        adaptive_refresh: 1,
        consecutive_failures: 0,
        avg_articles_per_fetch: 8,
        reliability_score: 0.85,
        is_active: 1
      }
    ];

    // Insert feed sources
    for (const source of sampleSources) {
      await db.saveFeed(source as any);
    }

    // Insert feed instances (using direct SQL for now)
    for (const instance of sampleInstances) {
      const sql = `
        INSERT OR REPLACE INTO feed_instances (
          id, source_id, instance_name, feed_url, refresh_tier,
          base_refresh_minutes, adaptive_refresh, consecutive_failures,
          avg_articles_per_fetch, reliability_score, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `;

      await new Promise<void>((resolve, reject) => {
        dbInstance.run(sql, [
          instance.id,
          instance.source_id,
          instance.instance_name,
          instance.feed_url,
          instance.refresh_tier,
          instance.base_refresh_minutes,
          instance.adaptive_refresh,
          instance.consecutive_failures,
          instance.avg_articles_per_fetch,
          instance.reliability_score,
          instance.is_active
        ], (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log(`✅ Created ${sampleSources.length} sample feed sources`);
    console.log(`✅ Created ${sampleInstances.length} sample feed instances`);
    
    console.log('\n📋 Sample feeds added:');
    sampleSources.forEach((source, index) => {
      const instance = sampleInstances[index];
      console.log(`   ${index + 1}. ${source.name} (${source.source_language})`);
      console.log(`      Category: ${source.content_category}`);
      console.log(`      Tier: ${instance?.refresh_tier}`);
      console.log(`      URL: ${instance?.feed_url}`);
    });

  } catch (error) {
    console.error('⚠️ Warning: Could not create sample data:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  simpleInitialization().catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
}