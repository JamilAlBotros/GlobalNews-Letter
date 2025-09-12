import { getDatabase, closeDatabase } from "./connection.js";
import { newsletterTemplateService } from "../services/newsletter-template-service.js";

export async function initializeDatabase(): Promise<void> {
  const db = getDatabase();

  await db.exec(`
    CREATE TABLE IF NOT EXISTS feeds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      language TEXT NOT NULL,
      region TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      last_fetched TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      detected_language TEXT,
      needs_manual_language_review BOOLEAN DEFAULT FALSE,
      summary TEXT,
      original_language TEXT,
      title TEXT NOT NULL,
      description TEXT,
      content TEXT,
      url TEXT NOT NULL UNIQUE,
      published_at TEXT NOT NULL,
      scraped_at TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS translation_jobs (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      article_title TEXT NOT NULL,
      source_language TEXT NOT NULL,
      target_languages TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      priority TEXT NOT NULL DEFAULT 'normal',
      progress_percentage INTEGER NOT NULL DEFAULT 0,
      assigned_worker TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      estimated_completion TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      error_message TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      cost_estimate REAL,
      CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
      CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
      CHECK (retry_count >= 0),
      CHECK (max_retries >= 0),
      CHECK (word_count >= 0)
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feeds_active ON feeds(is_active);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_translation_jobs_article_id ON translation_jobs(article_id);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_translation_jobs_status ON translation_jobs(status);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_translation_jobs_priority ON translation_jobs(priority);
  `);

  // Add new columns for enhanced features
  await db.exec(`
    ALTER TABLE articles ADD COLUMN reading_time_minutes INTEGER DEFAULT NULL;
  `).catch(() => {}); // Ignore if column already exists

  await db.exec(`
    ALTER TABLE articles ADD COLUMN is_bookmarked BOOLEAN DEFAULT FALSE;
  `).catch(() => {}); // Ignore if column already exists

  await db.exec(`
    ALTER TABLE feeds ADD COLUMN feed_category VARCHAR(50) DEFAULT NULL;
  `).catch(() => {}); // Ignore if column already exists

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_translation_jobs_created ON translation_jobs(created_at DESC);
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS polling_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      interval_minutes INTEGER NOT NULL,
      feed_filters TEXT NOT NULL,
      last_run_time TEXT,
      next_run_time TEXT,
      total_runs INTEGER NOT NULL DEFAULT 0,
      successful_runs INTEGER NOT NULL DEFAULT 0,
      failed_runs INTEGER NOT NULL DEFAULT 0,
      last_run_stats TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      CHECK (interval_minutes >= 1 AND interval_minutes <= 1440),
      CHECK (total_runs >= 0),
      CHECK (successful_runs >= 0),
      CHECK (failed_runs >= 0)
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_polling_jobs_active ON polling_jobs(is_active);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_polling_jobs_next_run ON polling_jobs(next_run_time);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_polling_jobs_created ON polling_jobs(created_at DESC);
  `);

  // Newsletter translation jobs table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_translation_jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      source_language TEXT NOT NULL DEFAULT 'en',
      target_languages TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'normal',
      original_articles TEXT NOT NULL,
      translated_content TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      assigned_worker TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      error_message TEXT,
      estimated_completion TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
      CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
      CHECK (progress >= 0 AND progress <= 100),
      CHECK (retry_count >= 0)
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_translation_status ON newsletter_translation_jobs(status);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_translation_created ON newsletter_translation_jobs(created_at DESC);
  `);

  // Google RSS feeds table - separate from regular feeds
  await db.exec(`
    CREATE TABLE IF NOT EXISTS google_rss_feeds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      mode TEXT NOT NULL CHECK (mode IN ('topic', 'search')),
      topic TEXT,
      search_query TEXT,
      time_frame TEXT,
      country TEXT NOT NULL,
      language TEXT NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      is_validated BOOLEAN DEFAULT FALSE,
      last_scraped TEXT,
      article_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_google_rss_active ON google_rss_feeds(is_active);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_google_rss_mode ON google_rss_feeds(mode);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_google_rss_created ON google_rss_feeds(created_at DESC);
  `);

  // Newsletter Issues Management
  await db.exec(`
    CREATE TABLE IF NOT EXISTS newsletters (
      id TEXT PRIMARY KEY,
      issue_number INTEGER NOT NULL UNIQUE,
      title TEXT NOT NULL,
      subtitle TEXT,
      publish_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      language TEXT NOT NULL DEFAULT 'en',
      content_metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT,
      CHECK (status IN ('draft', 'published', 'archived'))
    )
  `);

  // Reusable Newsletter Sections
  await db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_sections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      section_type TEXT NOT NULL,
      template_content TEXT NOT NULL,
      is_recurring BOOLEAN DEFAULT FALSE,
      display_order INTEGER DEFAULT 0,
      metadata TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      CHECK (section_type IN ('header', 'top_news', 'market_trends', 'footer', 'custom'))
    )
  `);

  // Newsletter Relations
  await db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_relations (
      id TEXT PRIMARY KEY,
      source_newsletter_id TEXT NOT NULL REFERENCES newsletters(id),
      target_newsletter_id TEXT NOT NULL REFERENCES newsletters(id),
      relation_type TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      CHECK (relation_type IN ('previous', 'next', 'related'))
    )
  `);

  // Article-Newsletter Assignments
  await db.exec(`
    CREATE TABLE IF NOT EXISTS newsletter_article_assignments (
      id TEXT PRIMARY KEY,
      newsletter_id TEXT NOT NULL REFERENCES newsletters(id),
      article_id TEXT NOT NULL REFERENCES articles(id),
      section_id TEXT REFERENCES newsletter_sections(id),
      position INTEGER NOT NULL DEFAULT 0,
      custom_title TEXT,
      custom_description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Newsletter indexes
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletters_issue_number ON newsletters(issue_number);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletters_status ON newsletters(status);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletters_publish_date ON newsletters(publish_date DESC);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_sections_type ON newsletter_sections(section_type);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_relations_source ON newsletter_relations(source_newsletter_id);
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_newsletter_assignments_newsletter ON newsletter_article_assignments(newsletter_id);
  `);

  // Seed default newsletter section templates
  try {
    await newsletterTemplateService.seedDefaultSections();
    console.log("Newsletter section templates seeded successfully");
  } catch (error) {
    console.error("Failed to seed newsletter templates:", error);
  }

  console.log("Database initialized successfully");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initializeDatabase()
    .then(async () => {
      console.log("Database initialization complete");
      await closeDatabase();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error("Database initialization failed:", error);
      await closeDatabase();
      process.exit(1);
    });
}