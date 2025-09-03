-- Create feeds table
CREATE TABLE IF NOT EXISTS feeds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  language TEXT NOT NULL,
  region TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_fetched TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for feeds
CREATE INDEX IF NOT EXISTS idx_feeds_active ON feeds(is_active);
CREATE INDEX IF NOT EXISTS idx_feeds_category ON feeds(category);

-- Create articles table
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  detected_language TEXT,
  needs_manual_language_review BOOLEAN DEFAULT false,
  summary TEXT,
  original_language TEXT,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  url TEXT NOT NULL UNIQUE,
  published_at TIMESTAMP NOT NULL,
  scraped_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for articles
CREATE INDEX IF NOT EXISTS idx_articles_feed_id ON articles(feed_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);

-- Create translation_jobs table
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
  estimated_completion TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  error_message TEXT,
  word_count INTEGER NOT NULL DEFAULT 0,
  cost_estimate REAL,
  
  -- Check constraints
  CONSTRAINT check_status CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  CONSTRAINT check_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT check_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  CONSTRAINT check_retry_count CHECK (retry_count >= 0),
  CONSTRAINT check_max_retries CHECK (max_retries >= 0),
  CONSTRAINT check_word_count CHECK (word_count >= 0)
);

-- Create indexes for translation_jobs
CREATE INDEX IF NOT EXISTS idx_translation_jobs_article_id ON translation_jobs(article_id);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_status ON translation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_priority ON translation_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_translation_jobs_created ON translation_jobs(created_at DESC);

-- Create polling_jobs table
CREATE TABLE IF NOT EXISTS polling_jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  interval_minutes INTEGER NOT NULL,
  feed_filters TEXT NOT NULL, -- JSON string
  last_run_time TIMESTAMP,
  next_run_time TIMESTAMP,
  total_runs INTEGER NOT NULL DEFAULT 0,
  successful_runs INTEGER NOT NULL DEFAULT 0,
  failed_runs INTEGER NOT NULL DEFAULT 0,
  last_run_stats TEXT, -- JSON string
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Check constraints
  CONSTRAINT check_interval CHECK (interval_minutes >= 1 AND interval_minutes <= 1440),
  CONSTRAINT check_total_runs CHECK (total_runs >= 0),
  CONSTRAINT check_successful_runs CHECK (successful_runs >= 0),
  CONSTRAINT check_failed_runs CHECK (failed_runs >= 0)
);

-- Create indexes for polling_jobs
CREATE INDEX IF NOT EXISTS idx_polling_jobs_active ON polling_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_polling_jobs_next_run ON polling_jobs(next_run_time);
CREATE INDEX IF NOT EXISTS idx_polling_jobs_created ON polling_jobs(created_at DESC);