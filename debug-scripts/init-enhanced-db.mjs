import sqlite3 from 'sqlite3';
import { v4 as uuidv4 } from 'uuid';

const db = new sqlite3.Database('./data/enhanced-rss.db');

console.log('🚀 Initializing enhanced RSS database...');

db.serialize(() => {
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
      is_active BOOLEAN DEFAULT 1,
      quality_score REAL DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating feed_sources table:', err);
    } else {
      console.log('✅ feed_sources table created');
    }
  });

  // Feed Instances table
  db.run(`
    CREATE TABLE IF NOT EXISTS feed_instances (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      instance_name TEXT NOT NULL,
      feed_url TEXT NOT NULL,
      feed_params TEXT,
      refresh_tier TEXT CHECK (refresh_tier IN ('realtime', 'frequent', 'standard', 'slow')) DEFAULT 'standard',
      base_refresh_minutes INTEGER DEFAULT 60,
      adaptive_refresh BOOLEAN DEFAULT 1,
      last_fetched DATETIME,
      last_success DATETIME,
      consecutive_failures INTEGER DEFAULT 0,
      avg_articles_per_fetch REAL DEFAULT 0,
      reliability_score REAL DEFAULT 1.0 CHECK (reliability_score >= 0 AND reliability_score <= 1),
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES feed_sources (id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating feed_instances table:', err);
    } else {
      console.log('✅ feed_instances table created');
    }
  });

  // Articles Original table
  db.run(`
    CREATE TABLE IF NOT EXISTS articles_original (
      id TEXT PRIMARY KEY,
      feed_instance_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      summary TEXT,
      author TEXT,
      source_url TEXT NOT NULL,
      image_url TEXT,
      published_at DATETIME NOT NULL,
      scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      detected_language TEXT NOT NULL CHECK (detected_language IN ('en', 'es', 'ar', 'pt', 'fr', 'zh', 'ja')),
      language_confidence REAL DEFAULT 0.5 CHECK (language_confidence >= 0 AND language_confidence <= 1),
      content_category TEXT CHECK (content_category IN ('finance', 'tech', 'health', 'general')),
      content_tags TEXT,
      urgency_level TEXT CHECK (urgency_level IN ('breaking', 'high', 'normal', 'low')) DEFAULT 'normal',
      content_quality TEXT CHECK (content_quality IN ('high', 'medium', 'low', 'failed')) DEFAULT 'medium',
      word_count INTEGER,
      readability_score REAL CHECK (readability_score >= 0 AND readability_score <= 1),
      processing_stage TEXT CHECK (processing_stage IN ('pending', 'processed', 'translated', 'published', 'failed')) DEFAULT 'pending',
      is_selected BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (feed_instance_id) REFERENCES feed_instances (id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating articles_original table:', err);
    } else {
      console.log('✅ articles_original table created');
    }
  });

  // Articles Translations table
  db.run(`
    CREATE TABLE IF NOT EXISTS articles_translations (
      id TEXT PRIMARY KEY,
      original_article_id TEXT NOT NULL,
      target_language TEXT NOT NULL CHECK (target_language IN ('en', 'es', 'ar', 'pt', 'fr', 'zh', 'ja')),
      title_translated TEXT NOT NULL,
      description_translated TEXT,
      content_translated TEXT,
      summary_translated TEXT,
      translation_method TEXT CHECK (translation_method IN ('ai', 'human', 'hybrid')) DEFAULT 'ai',
      translator_model TEXT,
      translation_quality_score REAL CHECK (translation_quality_score >= 0 AND translation_quality_score <= 1),
      translation_confidence REAL CHECK (translation_confidence >= 0 AND translation_confidence <= 1),
      human_reviewed BOOLEAN DEFAULT 0,
      translation_started_at DATETIME,
      translation_completed_at DATETIME,
      translation_status TEXT CHECK (translation_status IN ('pending', 'processing', 'completed', 'failed', 'review_needed')) DEFAULT 'pending',
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_article_id) REFERENCES articles_original (id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating articles_translations table:', err);
    } else {
      console.log('✅ articles_translations table created');
    }
  });

  // Feed Health Metrics table
  db.run(`
    CREATE TABLE IF NOT EXISTS feed_health_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_instance_id TEXT NOT NULL,
      check_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      response_time_ms INTEGER,
      articles_found INTEGER DEFAULT 0,
      articles_new INTEGER DEFAULT 0,
      articles_duplicates INTEGER DEFAULT 0,
      is_available BOOLEAN NOT NULL,
      http_status INTEGER,
      error_type TEXT,
      error_message TEXT,
      avg_content_length REAL,
      avg_language_confidence REAL CHECK (avg_language_confidence >= 0 AND avg_language_confidence <= 1),
      content_quality_distribution TEXT,
      optimal_refresh_minutes INTEGER,
      recommended_action TEXT CHECK (recommended_action IN ('increase_frequency', 'decrease_frequency', 'maintain', 'disable')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (feed_instance_id) REFERENCES feed_instances (id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating feed_health_metrics table:', err);
    } else {
      console.log('✅ feed_health_metrics table created');
    }
  });

  // Translation Jobs table
  db.run(`
    CREATE TABLE IF NOT EXISTS translation_jobs (
      id TEXT PRIMARY KEY,
      original_article_id TEXT NOT NULL,
      target_languages TEXT NOT NULL,
      priority TEXT CHECK (priority IN ('urgent', 'high', 'normal', 'low')) DEFAULT 'normal',
      status TEXT CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
      assigned_worker TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      estimated_completion DATETIME,
      translation_config TEXT,
      max_retries INTEGER DEFAULT 3,
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (original_article_id) REFERENCES articles_original (id)
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating translation_jobs table:', err);
    } else {
      console.log('✅ translation_jobs table created');
      
      // Insert some test data
      const testSources = [
        {
          id: uuidv4(),
          name: 'BBC News Tech',
          base_url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',
          provider_type: 'rss',
          source_language: 'en',
          primary_region: 'GB',
          content_category: 'tech',
          content_type: 'daily',
          is_active: 1,
          quality_score: 0.9
        },
        {
          id: uuidv4(),
          name: 'Reuters Finance',
          base_url: 'https://feeds.reuters.com/reuters/businessNews',
          provider_type: 'rss',
          source_language: 'en',
          primary_region: 'US',
          content_category: 'finance',
          content_type: 'breaking',
          is_active: 1,
          quality_score: 0.95
        },
        {
          id: uuidv4(),
          name: 'TechCrunch',
          base_url: 'https://techcrunch.com/feed/',
          provider_type: 'rss',
          source_language: 'en',
          primary_region: 'US',
          content_category: 'tech',
          content_type: 'analysis',
          is_active: 1,
          quality_score: 0.85
        }
      ];

      console.log('🌱 Inserting test data...');
      testSources.forEach((source, index) => {
        db.run(`
          INSERT INTO feed_sources (
            id, name, base_url, provider_type, source_language, primary_region,
            content_category, content_type, is_active, quality_score
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          source.id, source.name, source.base_url, source.provider_type,
          source.source_language, source.primary_region, source.content_category,
          source.content_type, source.is_active, source.quality_score
        ], (err) => {
          if (err) {
            console.error(`❌ Error inserting test source ${index + 1}:`, err);
          } else {
            console.log(`✅ Test source ${index + 1} inserted: ${source.name}`);
            
            // Check final count after last insert
            if (index === testSources.length - 1) {
              db.get('SELECT COUNT(*) as count FROM feed_sources', (err, row) => {
                if (err) {
                  console.error('❌ Error counting sources:', err);
                } else {
                  console.log(`🎉 Database initialization complete! Total sources: ${row.count}`);
                }
                db.close();
              });
            }
          }
        });
      });
    }
  });
});