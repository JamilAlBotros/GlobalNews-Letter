import { getDatabase, closeDatabase } from "./connection.js";

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