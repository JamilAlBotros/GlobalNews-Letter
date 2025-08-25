import sqlite3 from 'sqlite3';

/**
 * Database schema and manager for Google RSS feeds and article processing pipeline
 */

export interface GoogleRSSFeed {
  id: string;
  name: string;
  url: string;
  mode: 'topic' | 'search';
  topic?: string;
  searchQuery?: string;
  timeFrame?: string;
  country: string;
  language: string;
  isActive: boolean;
  isValidated: boolean;
  lastScraped?: string;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ArticleLink {
  id: string;
  feedId: string;
  title: string;
  link: string;
  pubDate: string;
  guid?: string;
  description?: string;
  scrapedAt: string;
  processed: boolean;
  processingStage: 'pending' | 'extracting' | 'summarizing' | 'completed' | 'failed';
  extractedAt?: string;
  summarizedAt?: string;
  errorMessage?: string;
}

export interface ProcessedArticle {
  id: string;
  linkId: string;
  feedId: string;
  title: string;
  originalUrl: string;
  extractedText?: string;
  summary?: string;
  wordCount?: number;
  extractionMethod: string;
  summaryMethod?: string;
  quality: 'high' | 'medium' | 'low' | 'failed';
  tags: string; // JSON array
  processedAt: string;
  createdAt: string;
}

export class GoogleRSSDatabaseManager {
  private db: sqlite3.Database;

  constructor(dbPath: string = 'data/google-rss.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Google RSS Feeds table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS google_rss_feeds (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            mode TEXT NOT NULL CHECK (mode IN ('topic', 'search')),
            topic TEXT,
            searchQuery TEXT,
            timeFrame TEXT,
            country TEXT NOT NULL,
            language TEXT NOT NULL,
            isActive BOOLEAN DEFAULT TRUE,
            isValidated BOOLEAN DEFAULT FALSE,
            lastScraped TEXT,
            articleCount INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Article Links table (scraped from RSS feeds)
        this.db.run(`
          CREATE TABLE IF NOT EXISTS article_links (
            id TEXT PRIMARY KEY,
            feedId TEXT NOT NULL,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            pubDate TEXT NOT NULL,
            guid TEXT,
            description TEXT,
            scrapedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            processed BOOLEAN DEFAULT FALSE,
            processingStage TEXT DEFAULT 'pending' CHECK (processingStage IN ('pending', 'extracting', 'summarizing', 'completed', 'failed')),
            extractedAt TEXT,
            summarizedAt TEXT,
            errorMessage TEXT,
            
            FOREIGN KEY (feedId) REFERENCES google_rss_feeds(id),
            UNIQUE(feedId, link)
          )
        `);

        // Processed Articles table (final processed content)
        this.db.run(`
          CREATE TABLE IF NOT EXISTS processed_articles (
            id TEXT PRIMARY KEY,
            linkId TEXT NOT NULL UNIQUE,
            feedId TEXT NOT NULL,
            title TEXT NOT NULL,
            originalUrl TEXT NOT NULL,
            extractedText TEXT,
            summary TEXT,
            wordCount INTEGER,
            extractionMethod TEXT NOT NULL,
            summaryMethod TEXT,
            quality TEXT DEFAULT 'medium' CHECK (quality IN ('high', 'medium', 'low', 'failed')),
            tags TEXT DEFAULT '[]', -- JSON array
            processedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (linkId) REFERENCES article_links(id),
            FOREIGN KEY (feedId) REFERENCES google_rss_feeds(id)
          )
        `);

        // Processing Statistics table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS processing_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feedId TEXT NOT NULL,
            date TEXT NOT NULL, -- YYYY-MM-DD format
            linksScraped INTEGER DEFAULT 0,
            articlesExtracted INTEGER DEFAULT 0,
            articlesSummarized INTEGER DEFAULT 0,
            processingErrors INTEGER DEFAULT 0,
            avgExtractionTime REAL DEFAULT 0, -- seconds
            avgSummaryTime REAL DEFAULT 0, -- seconds
            
            FOREIGN KEY (feedId) REFERENCES google_rss_feeds(id),
            UNIQUE(feedId, date)
          )
        `);

        // Create indexes for performance
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_article_links_feed_date ON article_links(feedId, scrapedAt)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_article_links_processing ON article_links(processed, processingStage)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_processed_articles_feed ON processed_articles(feedId, processedAt)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_processed_articles_quality ON processed_articles(quality, processedAt)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_processing_stats_date ON processing_stats(date, feedId)`);

        // Create useful views
        this.db.run(`
          CREATE VIEW IF NOT EXISTS feed_processing_summary AS
          SELECT 
            f.id,
            f.name,
            f.url,
            f.mode,
            f.country,
            f.language,
            f.isActive,
            f.isValidated,
            f.lastScraped,
            f.articleCount,
            COUNT(al.id) as totalLinks,
            COUNT(CASE WHEN al.processed = 1 THEN 1 END) as processedLinks,
            COUNT(pa.id) as completedArticles,
            COUNT(CASE WHEN pa.quality = 'high' THEN 1 END) as highQualityArticles,
            AVG(pa.wordCount) as avgWordCount
          FROM google_rss_feeds f
          LEFT JOIN article_links al ON f.id = al.feedId
          LEFT JOIN processed_articles pa ON al.id = pa.linkId
          GROUP BY f.id
        `);

        this.db.run(`
          CREATE VIEW IF NOT EXISTS daily_processing_overview AS
          SELECT 
            date,
            COUNT(DISTINCT feedId) as activeFeeds,
            SUM(linksScraped) as totalLinksScraped,
            SUM(articlesExtracted) as totalExtracted,
            SUM(articlesSummarized) as totalSummarized,
            SUM(processingErrors) as totalErrors,
            AVG(avgExtractionTime) as avgExtractionTime,
            AVG(avgSummaryTime) as avgSummaryTime
          FROM processing_stats
          GROUP BY date
          ORDER BY date DESC
        `);

        resolve();
      });
    });
  }

  // Google RSS Feed Management
  async saveFeed(feed: Omit<GoogleRSSFeed, 'createdAt' | 'updatedAt'>): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO google_rss_feeds (
          id, name, url, mode, topic, searchQuery, timeFrame, country, language,
          isActive, isValidated, lastScraped, articleCount, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;
      
      this.db.run(sql, [
        feed.id, feed.name, feed.url, feed.mode, feed.topic, feed.searchQuery,
        feed.timeFrame, feed.country, feed.language, feed.isActive, feed.isValidated,
        feed.lastScraped, feed.articleCount
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getFeed(feedId: string): Promise<GoogleRSSFeed | null> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM google_rss_feeds WHERE id = ?',
        [feedId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row as GoogleRSSFeed || null);
        }
      );
    });
  }

  async getActiveFeeds(): Promise<GoogleRSSFeed[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM google_rss_feeds WHERE isActive = 1 ORDER BY name',
        [],
        (err, rows) => {
          if (err) reject(err);
          else {
            const validatedRows = (rows || []).filter((row: any) => row.id != null) as GoogleRSSFeed[];
            resolve(validatedRows);
          }
        }
      );
    });
  }

  async validateFeed(feedId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE google_rss_feeds SET isValidated = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [feedId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Article Links Management
  async saveArticleLinks(links: Omit<ArticleLink, 'scrapedAt'>[]): Promise<number> {
    return new Promise((resolve, reject) => {
      let inserted = 0;
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO article_links 
        (id, feedId, title, link, pubDate, guid, description, processed, processingStage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertPromises = links.map(link => {
        return new Promise<void>((resolveInsert, rejectInsert) => {
          stmt.run([
            link.id, link.feedId, link.title, link.link, link.pubDate,
            link.guid, link.description, link.processed, link.processingStage
          ], function(err) {
            if (err) {
              rejectInsert(err);
            } else if (this.changes > 0) {
              inserted++;
              resolveInsert();
            } else {
              resolveInsert(); // Already exists
            }
          });
        });
      });

      Promise.all(insertPromises)
        .then(() => {
          stmt.finalize();
          resolve(inserted);
        })
        .catch(reject);
    });
  }

  async getPendingLinks(limit: number = 50): Promise<ArticleLink[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM article_links WHERE processed = 0 AND processingStage = "pending" ORDER BY scrapedAt ASC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as ArticleLink[] || []);
        }
      );
    });
  }

  async updateLinkProcessingStage(linkId: string, stage: ArticleLink['processingStage'], errorMessage?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const updateFields = ['processingStage = ?'];
      const values: any[] = [stage];

      if (stage === 'extracting') {
        updateFields.push('extractedAt = CURRENT_TIMESTAMP');
      } else if (stage === 'summarizing') {
        updateFields.push('summarizedAt = CURRENT_TIMESTAMP');
      } else if (stage === 'completed') {
        updateFields.push('processed = 1');
      } else if (stage === 'failed') {
        updateFields.push('errorMessage = ?');
        values.push(errorMessage || 'Unknown error');
      }

      values.push(linkId);

      this.db.run(
        `UPDATE article_links SET ${updateFields.join(', ')} WHERE id = ?`,
        values,
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Processed Articles Management
  async saveProcessedArticle(article: Omit<ProcessedArticle, 'createdAt'>): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO processed_articles (
          id, linkId, feedId, title, originalUrl, extractedText, summary, wordCount,
          extractionMethod, summaryMethod, quality, tags, processedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        article.id, article.linkId, article.feedId, article.title, article.originalUrl,
        article.extractedText, article.summary, article.wordCount, article.extractionMethod,
        article.summaryMethod, article.quality, article.tags, article.processedAt
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async getProcessedArticles(feedId?: string, limit: number = 100): Promise<ProcessedArticle[]> {
    return new Promise((resolve, reject) => {
      const sql = feedId 
        ? 'SELECT * FROM processed_articles WHERE feedId = ? ORDER BY processedAt DESC LIMIT ?'
        : 'SELECT * FROM processed_articles ORDER BY processedAt DESC LIMIT ?';
      
      const params = feedId ? [feedId, limit] : [limit];
      
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows as ProcessedArticle[] || []);
      });
    });
  }

  // Statistics and Analytics
  async updateProcessingStats(feedId: string, date: string, stats: Partial<{
    linksScraped: number;
    articlesExtracted: number;
    articlesSummarized: number;
    processingErrors: number;
    avgExtractionTime: number;
    avgSummaryTime: number;
  }>): Promise<void> {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(stats).map(key => `${key} = COALESCE(${key}, 0) + ?`).join(', ');
      const values = [...Object.values(stats), feedId, date];
      
      this.db.run(
        `INSERT OR IGNORE INTO processing_stats (feedId, date) VALUES (?, ?)`,
        [feedId, date],
        (insertErr) => {
          if (insertErr) {
            reject(insertErr);
            return;
          }
          
          this.db.run(
            `UPDATE processing_stats SET ${fields} WHERE feedId = ? AND date = ?`,
            values,
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        }
      );
    });
  }

  async getFeedProcessingSummary(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM feed_processing_summary ORDER BY completedArticles DESC',
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async getDailyProcessingOverview(days: number = 30): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM daily_processing_overview LIMIT ?',
        [days],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Utility methods
  async updateFeedLastScraped(feedId: string, articleCount: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE google_rss_feeds SET lastScraped = CURRENT_TIMESTAMP, articleCount = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
        [articleCount, feedId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async getFeedStats(feedId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT 
          COUNT(al.id) as totalLinks,
          COUNT(CASE WHEN al.processed = 1 THEN 1 END) as processedLinks,
          COUNT(pa.id) as completedArticles,
          COUNT(CASE WHEN pa.quality = 'high' THEN 1 END) as highQualityArticles,
          COUNT(CASE WHEN pa.quality = 'medium' THEN 1 END) as mediumQualityArticles,
          COUNT(CASE WHEN pa.quality = 'low' THEN 1 END) as lowQualityArticles,
          AVG(pa.wordCount) as avgWordCount
        FROM article_links al
        LEFT JOIN processed_articles pa ON al.id = pa.linkId
        WHERE al.feedId = ?`,
        [feedId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || {});
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => resolve());
    });
  }
}