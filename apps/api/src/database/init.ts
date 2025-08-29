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
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
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