#!/usr/bin/env node
import sqlite3 from 'sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * Minimal Database Initialization
 * Creates basic database structure without complex dependencies
 */

async function minimalInit() {
  console.log('🚀 Minimal Database Initialization...\n');

  try {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('✅ Created data directory');
    }

    // Create enhanced RSS database
    console.log('🔧 Creating enhanced RSS database...');
    const enhancedDbPath = path.join(dataDir, 'enhanced-rss.db');
    await createEnhancedDatabase(enhancedDbPath);
    console.log('✅ Enhanced RSS database created');

    // Create news database  
    console.log('📊 Creating news database...');
    const newsDbPath = path.join(dataDir, 'news.db');
    await createNewsDatabase(newsDbPath);
    console.log('✅ News database created');

    console.log('\n🎉 Database initialization complete!');
    console.log('\n📍 Database files:');
    
    // List created database files
    const dbFiles = fs.readdirSync(dataDir).filter(file => file.endsWith('.db'));
    dbFiles.forEach(file => {
      const filePath = path.join(dataDir, file);
      const stats = fs.statSync(filePath);
      const size = (stats.size / 1024).toFixed(1);
      console.log(`   - ${file} (${size} KB)`);
    });

    console.log('\n🔗 Next steps:');
    console.log('   1. Start adding RSS feeds via API');
    console.log('   2. Check the WIKI.md for feed management guide');
    console.log('   3. Run: npm run db:backup to create initial backup');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

async function createEnhancedDatabase(dbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // Enable WAL mode and foreign keys
      db.run("PRAGMA journal_mode=WAL");
      db.run("PRAGMA foreign_keys=ON");
      db.run("PRAGMA synchronous=NORMAL");

      // Feed Sources table
      db.run(`
        CREATE TABLE IF NOT EXISTS feed_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          base_url TEXT NOT NULL,
          provider_type TEXT CHECK (provider_type IN ('rss', 'google_rss', 'api', 'scraper')),
          source_language TEXT NOT NULL CHECK (source_language IN ('en', 'es', 'ar', 'pt', 'fr', 'zh', 'ja')),
          primary_region TEXT,
          content_category TEXT CHECK (content_category IN ('finance', 'tech', 'health', 'general')),
          content_type TEXT CHECK (content_type IN ('breaking', 'analysis', 'daily', 'weekly')),
          is_active BOOLEAN DEFAULT TRUE,
          quality_score REAL DEFAULT 0.5,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Feed Instances table
      db.run(`
        CREATE TABLE IF NOT EXISTS feed_instances (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL REFERENCES feed_sources(id),
          instance_name TEXT NOT NULL,
          feed_url TEXT NOT NULL,
          feed_params TEXT,
          refresh_tier TEXT CHECK (refresh_tier IN ('realtime', 'frequent', 'standard', 'slow')) DEFAULT 'standard',
          base_refresh_minutes INTEGER DEFAULT 60,
          adaptive_refresh BOOLEAN DEFAULT TRUE,
          last_fetched TEXT,
          last_success TEXT,
          consecutive_failures INTEGER DEFAULT 0,
          avg_articles_per_fetch REAL DEFAULT 0,
          reliability_score REAL DEFAULT 1.0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(source_id, feed_url)
        )
      `);

      // Articles Original table
      db.run(`
        CREATE TABLE IF NOT EXISTS articles_original (
          id TEXT PRIMARY KEY,
          feed_instance_id TEXT NOT NULL REFERENCES feed_instances(id),
          title TEXT NOT NULL,
          description TEXT,
          content TEXT,
          summary TEXT,
          author TEXT,
          source_url TEXT NOT NULL UNIQUE,
          image_url TEXT,
          published_at TEXT NOT NULL,
          scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
          detected_language TEXT NOT NULL,
          language_confidence REAL DEFAULT 0.0,
          content_category TEXT,
          content_tags TEXT,
          urgency_level TEXT CHECK (urgency_level IN ('breaking', 'high', 'normal', 'low')) DEFAULT 'normal',
          content_quality TEXT CHECK (content_quality IN ('high', 'medium', 'low', 'failed')) DEFAULT 'medium',
          word_count INTEGER,
          readability_score REAL,
          processing_stage TEXT CHECK (processing_stage IN ('pending', 'processed', 'translated', 'published', 'failed')) DEFAULT 'pending',
          is_selected BOOLEAN DEFAULT FALSE,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Articles Translations table
      db.run(`
        CREATE TABLE IF NOT EXISTS articles_translations (
          id TEXT PRIMARY KEY,
          original_article_id TEXT NOT NULL REFERENCES articles_original(id),
          target_language TEXT NOT NULL CHECK (target_language IN ('en', 'es', 'ar', 'pt', 'fr', 'zh', 'ja')),
          title_translated TEXT NOT NULL,
          description_translated TEXT,
          content_translated TEXT,
          summary_translated TEXT,
          translation_method TEXT CHECK (translation_method IN ('ai', 'human', 'hybrid')) DEFAULT 'ai',
          translator_model TEXT,
          translation_quality_score REAL,
          translation_confidence REAL,
          human_reviewed BOOLEAN DEFAULT FALSE,
          translation_started_at TEXT,
          translation_completed_at TEXT,
          translation_status TEXT CHECK (translation_status IN ('pending', 'processing', 'completed', 'failed', 'review_needed')) DEFAULT 'pending',
          error_message TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(original_article_id, target_language)
        )
      `);

      // Translation Jobs table
      db.run(`
        CREATE TABLE IF NOT EXISTS translation_jobs (
          id TEXT PRIMARY KEY,
          original_article_id TEXT NOT NULL REFERENCES articles_original(id),
          target_languages TEXT NOT NULL,
          priority TEXT CHECK (priority IN ('urgent', 'high', 'normal', 'low')) DEFAULT 'normal',
          status TEXT CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
          assigned_worker TEXT,
          started_at TEXT,
          completed_at TEXT,
          estimated_completion TEXT,
          translation_config TEXT,
          max_retries INTEGER DEFAULT 3,
          retry_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create indexes
      db.run(`CREATE INDEX IF NOT EXISTS idx_feed_instances_active ON feed_instances(is_active, refresh_tier)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_articles_original_stage ON articles_original(processing_stage)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_articles_translations_status ON articles_translations(translation_status)`);

      // Insert sample data
      const sampleSources = [
        ['reuters-finance-001', 'Reuters Finance', 'https://reuters.com', 'rss', 'en', 'us', 'finance', 'breaking', 1, 0.9],
        ['techcrunch-001', 'TechCrunch', 'https://techcrunch.com', 'rss', 'en', 'us', 'tech', 'daily', 1, 0.85],
        ['elpais-salud-001', 'El País Salud', 'https://elpais.com', 'rss', 'es', 'es', 'health', 'daily', 1, 0.8]
      ];

      const sourceStmt = db.prepare(`
        INSERT OR REPLACE INTO feed_sources (
          id, name, base_url, provider_type, source_language, primary_region,
          content_category, content_type, is_active, quality_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      sampleSources.forEach(source => sourceStmt.run(source));
      sourceStmt.finalize();

      const sampleInstances = [
        ['reuters-business-feed', 'reuters-finance-001', 'Reuters Business News', 'https://feeds.reuters.com/reuters/businessNews', 'frequent', 30],
        ['techcrunch-main-feed', 'techcrunch-001', 'TechCrunch Main Feed', 'https://techcrunch.com/feed/', 'standard', 60],
        ['elpais-salud-feed', 'elpais-salud-001', 'El País - Sección Salud', 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/section/sociedad/salud', 'standard', 90]
      ];

      const instanceStmt = db.prepare(`
        INSERT OR REPLACE INTO feed_instances (
          id, source_id, instance_name, feed_url, refresh_tier, base_refresh_minutes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      sampleInstances.forEach(instance => instanceStmt.run(instance));
      instanceStmt.finalize();

      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

async function createNewsDatabase(dbPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath);

    db.serialize(() => {
      // Legacy articles table for backward compatibility
      db.run(`
        CREATE TABLE IF NOT EXISTS articles (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT,
          description TEXT,
          url TEXT NOT NULL UNIQUE,
          imageUrl TEXT,
          publishedAt TEXT NOT NULL,
          content TEXT,
          category TEXT NOT NULL,
          source TEXT NOT NULL,
          summary TEXT,
          language TEXT NOT NULL DEFAULT 'english',
          originalLanguage TEXT NOT NULL DEFAULT 'english',
          isSelected INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL
        )
      `);

      // Legacy RSS feeds table
      db.run(`
        CREATE TABLE IF NOT EXISTS rss_feeds (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          url TEXT NOT NULL UNIQUE,
          category TEXT NOT NULL,
          language TEXT NOT NULL DEFAULT 'english',
          isActive INTEGER NOT NULL DEFAULT 1,
          lastFetched TEXT,
          createdAt TEXT NOT NULL,
          description TEXT
        )
      `);

      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  minimalInit().catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
}