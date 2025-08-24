import sqlite3 from 'sqlite3';
import { RSSProvider } from '../providers/rss.js';

/**
 * Configuration for RSS polling
 */
interface PollerConfig {
  feedUrl: string;
  intervalMinutes: number;
  maxArticles?: number;
  dbPath?: string;
}

/**
 * Article record for database storage
 */
interface ArticleRecord {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  createdAt: string;
}

/**
 * Simple RSS polling service that monitors feeds for new articles
 */
export class RSSPoller {
  private config: PollerConfig;
  private db: sqlite3.Database;
  private rssProvider: RSSProvider;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: PollerConfig) {
    this.config = {
      maxArticles: 1000,
      dbPath: 'data/rss-poller.db',
      ...config
    };
    
    this.rssProvider = new RSSProvider();
    this.db = new sqlite3.Database(this.config.dbPath!);
  }

  /**
   * Initialize the database and create tables if needed
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Create articles table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            pubDate TEXT,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(new Error(`Failed to create articles table: ${err.message}`));
            return;
          }

          // Create index on createdAt for cleanup operations
          this.db.run(`
            CREATE INDEX IF NOT EXISTS idx_articles_created 
            ON articles(createdAt)
          `, (indexErr) => {
            if (indexErr) {
              console.warn(`Warning: Failed to create index: ${indexErr.message}`);
            }
            resolve();
          });
        });
      });
    });
  }

  /**
   * Start polling the RSS feed
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('RSS poller is already running');
      return;
    }

    console.log(`🚀 Starting RSS poller for: ${this.config.feedUrl}`);
    console.log(`📅 Polling interval: ${this.config.intervalMinutes} minutes`);
    
    this.isRunning = true;
    
    // Initial fetch
    await this.pollFeed();
    
    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.pollFeed();
      }
    }, this.config.intervalMinutes * 60 * 1000);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('RSS poller is not running');
      return;
    }

    console.log('🛑 Stopping RSS poller...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Close database connection
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      this.stop();
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        }
        resolve();
      });
    });
  }

  /**
   * Poll the RSS feed and process new articles
   */
  private async pollFeed(): Promise<void> {
    try {
      console.log(`\n⏳ Polling RSS feed at ${new Date().toISOString()}...`);
      
      const { articles } = await this.rssProvider.fetchFeed(this.config.feedUrl);
      console.log(`📰 Found ${articles.length} articles in feed`);

      let newCount = 0;
      
      for (const article of articles) {
        const articleId = this.generateArticleId(article);
        const exists = await this.articleExists(articleId);
        
        if (!exists) {
          await this.insertArticle({
            id: articleId,
            title: article.title,
            link: article.link,
            pubDate: article.pubDate || new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
          
          newCount++;
          this.notifyNewArticle(article.title, article.link);
        }
      }

      if (newCount === 0) {
        console.log('✅ No new articles found');
      } else {
        console.log(`🆕 Found ${newCount} new articles`);
      }

      // Clean up old articles if configured
      if (this.config.maxArticles) {
        await this.cleanupOldArticles();
      }

    } catch (error) {
      console.error('❌ Error polling RSS feed:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Generate unique article ID from GUID or link
   */
  private generateArticleId(article: any): string {
    if (article.guid) {
      return article.guid;
    }
    
    // Fallback to link-based hash
    const input = article.link || article.title;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `link-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Check if article already exists in database
   */
  private async articleExists(articleId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM articles WHERE id = ?',
        [articleId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Insert new article into database
   */
  private async insertArticle(article: ArticleRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO articles (id, title, link, pubDate, createdAt) VALUES (?, ?, ?, ?, ?)',
        [article.id, article.title, article.link, article.pubDate, article.createdAt],
        function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        }
      );
    });
  }

  /**
   * Clean up old articles to maintain database size limit
   */
  private async cleanupOldArticles(): Promise<void> {
    if (!this.config.maxArticles) return;

    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM articles 
        WHERE id NOT IN (
          SELECT id FROM articles 
          ORDER BY createdAt DESC 
          LIMIT ?
        )
      `, [this.config.maxArticles], function(err) {
        if (err) {
          reject(err);
          return;
        }
        if (this.changes > 0) {
          console.log(`🗑️ Cleaned up ${this.changes} old articles`);
        }
        resolve();
      });
    });
  }

  /**
   * Notify about new article (placeholder for future integrations)
   */
  private notifyNewArticle(title: string, link: string): void {
    console.log(`🆕 NEW: ${title}`);
    console.log(`   📎 ${link}`);
    
    // Placeholder for future notification integrations:
    // - Email notifications
    // - Webhook calls
    // - Push notifications
    // - Slack/Discord messages
  }

  /**
   * Get recent articles from database
   */
  async getRecentArticles(limit: number = 10): Promise<ArticleRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM articles ORDER BY createdAt DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows as ArticleRecord[]);
        }
      );
    });
  }

  /**
   * Get total article count
   */
  async getArticleCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM articles',
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row.count);
        }
      );
    });
  }
}