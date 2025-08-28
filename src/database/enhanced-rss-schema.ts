import sqlite3 from 'sqlite3';

/**
 * Enhanced RSS Feed and Translation Database Schema
 * Optimized for bi-directional translations, feed health monitoring, and performance
 */

export interface FeedSource {
  id: string;
  name: string;
  base_url: string;
  provider_type: 'rss' | 'google_rss' | 'api' | 'scraper';
  source_language: 'en' | 'es' | 'ar' | 'pt' | 'fr' | 'zh' | 'ja';
  primary_region?: string;
  content_category: 'finance' | 'tech' | 'health' | 'general';
  content_type: 'breaking' | 'analysis' | 'daily' | 'weekly';
  is_active: boolean;
  quality_score: number; // 0-1
  created_at: string;
  updated_at: string;
}

export interface FeedInstance {
  id: string;
  source_id: string;
  instance_name: string;
  feed_url: string;
  feed_params?: string; // JSON
  
  // Refresh Strategy
  refresh_tier: 'realtime' | 'frequent' | 'standard' | 'slow';
  base_refresh_minutes: number;
  adaptive_refresh: boolean;
  
  // Health Monitoring
  last_fetched?: string;
  last_success?: string;
  consecutive_failures: number;
  avg_articles_per_fetch: number;
  reliability_score: number; // 0-1
  
  // Status
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ArticleOriginal {
  id: string;
  feed_instance_id: string;
  
  // Content
  title: string;
  description?: string;
  content?: string;
  summary?: string; // AI-generated summary in original language
  author?: string;
  
  // Metadata
  source_url: string;
  image_url?: string;
  published_at: string;
  scraped_at: string;
  
  // Classification
  detected_language: string;
  language_confidence: number;
  content_category?: string;
  content_tags?: string; // JSON array
  urgency_level: 'breaking' | 'high' | 'normal' | 'low';
  
  // Quality Metrics
  content_quality: 'high' | 'medium' | 'low' | 'failed';
  word_count?: number;
  readability_score?: number;
  
  // Processing Status
  processing_stage: 'pending' | 'processed' | 'translated' | 'published' | 'failed';
  is_selected: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface ArticleTranslation {
  id: string;
  original_article_id: string;
  target_language: 'en' | 'es' | 'ar' | 'pt' | 'fr' | 'zh' | 'ja';
  
  // Translated Content
  title_translated: string;
  description_translated?: string;
  content_translated?: string;
  summary_translated?: string;
  
  // Translation Metadata
  translation_method: 'ai' | 'human' | 'hybrid';
  translator_model?: string;
  translation_quality_score?: number; // 0-1
  translation_confidence?: number; // 0-1
  human_reviewed: boolean;
  
  // Processing
  translation_started_at?: string;
  translation_completed_at?: string;
  translation_status: 'pending' | 'processing' | 'completed' | 'failed' | 'review_needed';
  error_message?: string;
  
  created_at: string;
  updated_at: string;
}

export interface FeedHealthMetric {
  id: number;
  feed_instance_id: string;
  check_timestamp: string;
  
  // Performance Metrics
  response_time_ms?: number;
  articles_found: number;
  articles_new: number;
  articles_duplicates: number;
  
  // Health Status
  is_available: boolean;
  http_status?: number;
  error_type?: string;
  error_message?: string;
  
  // Content Quality
  avg_content_length?: number;
  avg_language_confidence?: number;
  content_quality_distribution?: string; // JSON
  
  // Adaptive Metrics
  optimal_refresh_minutes?: number;
  recommended_action?: 'increase_frequency' | 'decrease_frequency' | 'maintain' | 'disable';
  
  created_at: string;
}

export interface TranslationJob {
  id: string;
  original_article_id: string;
  target_languages: string; // JSON array
  priority: 'urgent' | 'high' | 'normal' | 'low';
  
  // Job Status
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  assigned_worker?: string;
  started_at?: string;
  completed_at?: string;
  estimated_completion?: string;
  
  // Configuration
  translation_config?: string; // JSON
  max_retries: number;
  retry_count: number;
  
  created_at: string;
  updated_at: string;
}

export class EnhancedRSSDatabaseManager {
  private db: sqlite3.Database;

  constructor(dbPath: string = 'data/enhanced-rss.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Feed Sources table
        this.db.run(`
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
        this.db.run(`
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
        this.db.run(`
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
        this.db.run(`
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

        // Feed Health Metrics table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS feed_health_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed_instance_id TEXT NOT NULL REFERENCES feed_instances(id),
            check_timestamp TEXT NOT NULL,
            
            response_time_ms INTEGER,
            articles_found INTEGER DEFAULT 0,
            articles_new INTEGER DEFAULT 0,
            articles_duplicates INTEGER DEFAULT 0,
            
            is_available BOOLEAN NOT NULL,
            http_status INTEGER,
            error_type TEXT,
            error_message TEXT,
            
            avg_content_length REAL,
            avg_language_confidence REAL,
            content_quality_distribution TEXT,
            
            optimal_refresh_minutes INTEGER,
            recommended_action TEXT CHECK (recommended_action IN ('increase_frequency', 'decrease_frequency', 'maintain', 'disable')),
            
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Translation Jobs table
        this.db.run(`
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

        // Create performance indexes
        this.createIndexes();

        // Create strategic views
        this.createViews();

        resolve();
      });
    });
  }

  private createIndexes(): void {
    // Feed Management
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_feed_instances_active_tier ON feed_instances(is_active, refresh_tier)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_feed_sources_language_category ON feed_sources(source_language, content_category)`);

    // Articles
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_original_feed_published ON articles_original(feed_instance_id, published_at)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_original_language_quality ON articles_original(detected_language, content_quality)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_original_processing_stage ON articles_original(processing_stage)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_original_urgency ON articles_original(urgency_level, published_at)`);

    // Translations
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_translations_original_lang ON articles_translations(original_article_id, target_language)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_translations_status ON articles_translations(translation_status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_translations_quality ON articles_translations(translation_quality_score)`);

    // Health & Jobs
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_feed_health_metrics_feed_timestamp ON feed_health_metrics(feed_instance_id, check_timestamp)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_translation_jobs_status_priority ON translation_jobs(status, priority)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_translation_jobs_article ON translation_jobs(original_article_id)`);
  }

  private createViews(): void {
    // Feed Performance Summary
    this.db.run(`
      CREATE VIEW IF NOT EXISTS feed_performance_summary AS
      SELECT 
        fi.id,
        fs.name as source_name,
        fi.instance_name,
        fs.source_language,
        fs.content_category,
        fi.refresh_tier,
        fi.reliability_score,
        COUNT(ao.id) as total_articles_24h,
        COUNT(CASE WHEN ao.content_quality = 'high' THEN 1 END) as high_quality_articles,
        AVG(fhm.response_time_ms) as avg_response_time,
        MAX(fi.last_success) as last_successful_fetch
      FROM feed_instances fi
      JOIN feed_sources fs ON fi.source_id = fs.id
      LEFT JOIN articles_original ao ON fi.id = ao.feed_instance_id 
        AND ao.created_at > datetime('now', '-1 day')
      LEFT JOIN feed_health_metrics fhm ON fi.id = fhm.feed_instance_id 
        AND fhm.created_at > datetime('now', '-1 day')
      WHERE fi.is_active = TRUE
      GROUP BY fi.id
    `);

    // Translation Pipeline Status
    this.db.run(`
      CREATE VIEW IF NOT EXISTS translation_pipeline_status AS
      SELECT 
        ao.content_category,
        ao.detected_language as source_lang,
        COUNT(ao.id) as total_articles,
        COUNT(CASE WHEN ao.processing_stage = 'translated' THEN 1 END) as translated,
        COUNT(CASE WHEN tj.status = 'queued' THEN 1 END) as queued_jobs,
        COUNT(CASE WHEN tj.status = 'processing' THEN 1 END) as processing_jobs,
        AVG(at.translation_quality_score) as avg_translation_quality
      FROM articles_original ao
      LEFT JOIN translation_jobs tj ON ao.id = tj.original_article_id
      LEFT JOIN articles_translations at ON ao.id = at.original_article_id
      WHERE ao.created_at > datetime('now', '-7 days')
      GROUP BY ao.content_category, ao.detected_language
    `);

    // Daily Performance Overview
    this.db.run(`
      CREATE VIEW IF NOT EXISTS daily_performance_overview AS
      SELECT 
        DATE(fhm.check_timestamp) as date,
        COUNT(DISTINCT fhm.feed_instance_id) as active_feeds,
        SUM(fhm.articles_found) as total_articles_found,
        SUM(fhm.articles_new) as total_new_articles,
        AVG(fhm.response_time_ms) as avg_response_time,
        COUNT(CASE WHEN fhm.is_available = 0 THEN 1 END) as failed_checks,
        COUNT(fhm.id) as total_checks
      FROM feed_health_metrics fhm
      WHERE fhm.check_timestamp > datetime('now', '-30 days')
      GROUP BY DATE(fhm.check_timestamp)
      ORDER BY date DESC
    `);
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => resolve());
    });
  }
}