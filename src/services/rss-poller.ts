import sqlite3 from 'sqlite3';
import { RSSProvider } from '../providers/rss.js';
import { HealthDatabaseManager } from '../database/health-schema.js';

/**
 * Configuration for RSS polling
 */
interface PollerConfig {
  feedUrl: string;
  intervalMinutes: number;
  maxArticles?: number;
  dbPath?: string;
  feedId?: string;
  feedName?: string;
  country?: string;
  language?: string;
  category?: string;
  enableHealthTracking?: boolean;
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
  content?: string;
  author?: string;
  feedId?: string;
  feedName?: string;
  country?: string;
  language?: string;
  category?: string;
}

/**
 * Simple RSS polling service that monitors feeds for new articles
 */
export class RSSPoller {
  private config: PollerConfig;
  private db: sqlite3.Database;
  private rssProvider: RSSProvider;
  private healthManager?: HealthDatabaseManager;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: PollerConfig) {
    this.config = {
      maxArticles: 1000,
      dbPath: 'data/rss-poller.db',
      enableHealthTracking: false,
      ...config
    };
    
    this.rssProvider = new RSSProvider();
    this.db = new sqlite3.Database(this.config.dbPath!);
    
    // Initialize health tracking if enabled
    if (this.config.enableHealthTracking) {
      this.healthManager = new HealthDatabaseManager(this.config.dbPath!);
    }
  }

  /**
   * Initialize the database and create tables if needed
   */
  async initialize(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Initialize health tables if health tracking is enabled
        if (this.healthManager) {
          await this.healthManager.initializeHealthTables();
        }

        this.db.serialize(() => {
          // Create enhanced articles table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS articles (
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              link TEXT NOT NULL,
              content TEXT,
              author TEXT,
              pubDate TEXT,
              
              -- Feed information
              feedId TEXT,
              feedName TEXT,
              country TEXT,
              language TEXT,
              category TEXT,
              
              -- Health metrics
              titleLength INTEGER,
              contentLength INTEGER,
              hasAuthor BOOLEAN DEFAULT FALSE,
              hasValidDate BOOLEAN DEFAULT TRUE,
              
              createdAt TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `, (err) => {
            if (err) {
              reject(new Error(`Failed to create articles table: ${err.message}`));
              return;
            }

            // Create feeds table if health tracking enabled
            const createFeedsTable = this.config.enableHealthTracking ? `
              CREATE TABLE IF NOT EXISTS feeds (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                country TEXT NOT NULL,
                language TEXT NOT NULL,
                category TEXT NOT NULL,
                intervalMinutes INTEGER DEFAULT 15,
                isActive BOOLEAN DEFAULT TRUE,
                lastFetched TEXT,
                errorCount INTEGER DEFAULT 0,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
              )
            ` : '';

            if (createFeedsTable) {
              this.db.run(createFeedsTable, (feedErr) => {
                if (feedErr) {
                  console.warn(`Warning: Failed to create feeds table: ${feedErr.message}`);
                }
              });
            }

            // Create indexes
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(createdAt)`);
            this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feedId, createdAt)`);

            resolve();
          });
        });
      } catch (error) {
        reject(error);
      }
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
      this.intervalId = undefined as NodeJS.Timeout | undefined;
    }
  }


  /**
   * Poll the RSS feed and process new articles
   */
  private async pollFeed(): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;
    let errorMessage: string | undefined;
    let httpStatus = 200;
    let articlesFound = 0;

    try {
      console.log(`\n⏳ Polling RSS feed at ${new Date().toISOString()}...`);
      
      const { articles, metadata } = await this.rssProvider.fetchFeed(this.config.feedUrl);
      console.log(`📰 Found ${articles.length} articles in feed`);
      
      articlesFound = articles.length;
      success = true;

      let newCount = 0;
      
      for (const article of articles) {
        const articleId = this.generateArticleId(article);
        const exists = await this.articleExists(articleId);
        
        if (!exists) {
          const articleRecord: ArticleRecord = {
            id: articleId,
            title: article.title,
            link: article.link,
            content: article.content || article.contentSnippet || undefined,
            author: article.author || undefined,
            pubDate: article.pubDate || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            feedId: this.config.feedId || undefined,
            feedName: this.config.feedName || undefined,
            country: this.config.country || undefined,
            language: this.config.language || undefined,
            category: this.config.category || undefined
          };

          await this.insertArticle(articleRecord);
          
          newCount++;
          this.notifyNewArticle(article.title, article.link);
        }
      }

      if (newCount === 0) {
        console.log('✅ No new articles found');
      } else {
        console.log(`🆕 Found ${newCount} new articles`);
      }

      // Update feed last fetched time if health tracking enabled
      if (this.healthManager && this.config.feedId) {
        await this.updateFeedLastFetched(this.config.feedId);
      }

      // Clean up old articles if configured
      if (this.config.maxArticles) {
        await this.cleanupOldArticles();
      }

    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
      
      // Determine error type
      if (errorMessage.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('DNS') || errorMessage.includes('ENOTFOUND')) {
        errorType = 'dns_error';
      } else if (errorMessage.includes('HTTP')) {
        errorType = 'http_error';
        const statusMatch = errorMessage.match(/(\d{3})/);
        if (statusMatch) {
          httpStatus = parseInt(statusMatch[1]);
        }
      } else if (errorMessage.includes('parse') || errorMessage.includes('XML')) {
        errorType = 'parse_error';
      } else {
        errorType = 'unknown_error';
      }

      console.error('❌ Error polling RSS feed:', errorMessage);

      // Update error count if health tracking enabled
      if (this.healthManager && this.config.feedId) {
        await this.incrementFeedErrorCount(this.config.feedId);
      }
    } finally {
      const responseTime = Date.now() - startTime;

      // Log technical metrics if health tracking enabled
      if (this.healthManager && this.config.feedId) {
        await this.healthManager.logTechnicalMetrics({
          feedId: this.config.feedId,
          timestamp: new Date().toISOString(),
          responseTime,
          httpStatus,
          success,
          errorType,
          errorMessage,
          contentLength: 0, // Would need to capture actual content length
          encoding: 'utf-8', // Would need to detect actual encoding
          parseTime: 0, // Would need to measure parse time separately
          articlesFound
        });
      }
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
      const sql = `
        INSERT INTO articles (
          id, title, link, content, author, pubDate, feedId, feedName, 
          country, language, category, titleLength, contentLength, 
          hasAuthor, hasValidDate, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const values = [
        article.id,
        article.title,
        article.link,
        article.content || null,
        article.author || null,
        article.pubDate,
        article.feedId || null,
        article.feedName || null,
        article.country || null,
        article.language || null,
        article.category || null,
        article.title?.length || 0,
        article.content?.length || 0,
        !!article.author,
        !!article.pubDate,
        article.createdAt
      ];

      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
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

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    return new Promise(async (resolve) => {
      this.stop();
      
      // Close health manager if initialized
      if (this.healthManager) {
        await this.healthManager.close();
      }
      
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        }
        resolve();
      });
    });
  }

  /**
   * Helper method to update feed last fetched time
   */
  private async updateFeedLastFetched(feedId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE feeds SET lastFetched = ?, errorCount = 0 WHERE id = ?',
        [new Date().toISOString(), feedId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Helper method to increment feed error count
   */
  private async incrementFeedErrorCount(feedId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE feeds SET errorCount = errorCount + 1 WHERE id = ?',
        [feedId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }
}