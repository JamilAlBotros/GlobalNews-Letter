import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { z } from 'zod';
import type { 
  Article, 
  DatabaseArticle, 
  RSSFeed,
  DatabaseRSSFeed,
  Category, 
  Language,
  FilterOptions
} from '../types/index.js';
import { DatabaseArticleSchema, DatabaseRSSFeedSchema } from '../types/index.js';
import { appConfig } from '../config/index.js';

/**
 * SQLite database service for storing and managing articles
 */
export class DatabaseService {
  private db: sqlite3.Database;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;
  private dbRun: (sql: string, ...params: any[]) => Promise<sqlite3.RunResult>;
  private dbExec: (sql: string) => Promise<void>;

  constructor() {
    this.db = new sqlite3.Database(appConfig.DATABASE_PATH);
    
    // Promisify database methods
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbExec = promisify(this.db.exec.bind(this.db));
    
    this.initializeTables();
  }

  /**
   * Initialize database tables
   */
  private async initializeTables(): Promise<void> {
    const createArticlesTable = `
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
        createdAt TEXT NOT NULL,
        CONSTRAINT fk_category CHECK (category IN ('finance', 'tech')),
        CONSTRAINT fk_language CHECK (language IN ('english', 'spanish', 'arabic')),
        CONSTRAINT fk_originalLanguage CHECK (originalLanguage IN ('english', 'spanish', 'arabic'))
      )
    `;

    const createRSSFeedsTable = `
      CREATE TABLE IF NOT EXISTS rss_feeds (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT 'english',
        isActive INTEGER NOT NULL DEFAULT 1,
        lastFetched TEXT,
        createdAt TEXT NOT NULL,
        description TEXT,
        CONSTRAINT fk_rss_category CHECK (category IN ('finance', 'tech')),
        CONSTRAINT fk_rss_language CHECK (language IN ('english', 'spanish', 'arabic'))
      )
    `;

    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)',
      'CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language)',
      'CREATE INDEX IF NOT EXISTS idx_articles_publishedAt ON articles(publishedAt)',
      'CREATE INDEX IF NOT EXISTS idx_articles_isSelected ON articles(isSelected)',
      'CREATE INDEX IF NOT EXISTS idx_articles_source ON articles(source)',
      'CREATE INDEX IF NOT EXISTS idx_rss_feeds_category ON rss_feeds(category)',
      'CREATE INDEX IF NOT EXISTS idx_rss_feeds_isActive ON rss_feeds(isActive)',
      'CREATE INDEX IF NOT EXISTS idx_rss_feeds_lastFetched ON rss_feeds(lastFetched)'
    ];

    try {
      await this.dbExec(createArticlesTable);
      await this.dbExec(createRSSFeedsTable);
      for (const index of createIndexes) {
        await this.dbExec(index);
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  /**
   * Insert or update an article
   */
  async saveArticle(article: Article): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO articles (
        id, title, author, description, url, imageUrl, publishedAt,
        content, category, source, summary, language, originalLanguage,
        isSelected, createdAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?
      )
    `;

    try {
      await this.dbRun(sql,
        article.id,
        article.title,
        article.author,
        article.description,
        article.url,
        article.imageUrl,
        article.publishedAt.toISOString(),
        article.content,
        article.category,
        article.source,
        article.summary,
        article.language,
        article.originalLanguage,
        article.isSelected ? 1 : 0,
        article.createdAt.toISOString()
      );
    } catch (error) {
      console.error('Failed to save article:', error);
      throw error;
    }
  }

  /**
   * Save multiple articles in a transaction
   */
  async saveArticles(articles: Article[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        let completed = 0;
        let hasError = false;

        for (const article of articles) {
          if (hasError) break;

          this.saveArticle(article)
            .then(() => {
              completed++;
              if (completed === articles.length) {
                this.db.run('COMMIT', (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              }
            })
            .catch((error) => {
              hasError = true;
              this.db.run('ROLLBACK', () => {
                reject(error);
              });
            });
        }
      });
    });
  }

  /**
   * Get articles with optional filters
   */
  async getArticles(filters: Partial<FilterOptions> = {}): Promise<Article[]> {
    let sql = 'SELECT * FROM articles WHERE 1=1';
    const params: any[] = [];

    if (filters.categories && filters.categories.length > 0) {
      const placeholders = filters.categories.map(() => '?').join(',');
      sql += ` AND category IN (${placeholders})`;
      params.push(...filters.categories);
    }

    if (filters.language) {
      sql += ' AND language = ?';
      params.push(filters.language);
    }

    if (filters.dateFrom) {
      sql += ' AND publishedAt >= ?';
      params.push(filters.dateFrom.toISOString());
    }

    if (filters.dateTo) {
      sql += ' AND publishedAt <= ?';
      params.push(filters.dateTo.toISOString());
    }

    if (filters.sources && filters.sources.length > 0) {
      const placeholders = filters.sources.map(() => '?').join(',');
      sql += ` AND source IN (${placeholders})`;
      params.push(...filters.sources);
    }

    if (filters.keyword) {
      sql += ' AND (title LIKE ? OR description LIKE ? OR content LIKE ?)';
      const keyword = `%${filters.keyword}%`;
      params.push(keyword, keyword, keyword);
    }

    // Add ordering
    const sortBy = filters.sortBy || 'publishedAt';
    if (sortBy === 'publishedAt') {
      sql += ' ORDER BY publishedAt DESC';
    } else if (sortBy === 'popularity') {
      sql += ' ORDER BY source, publishedAt DESC';
    } else {
      sql += ' ORDER BY title';
    }

    try {
      const rows = await this.dbAll(sql, ...params) as DatabaseArticle[];
      return rows.map(row => this.mapDatabaseToArticle(row));
    } catch (error) {
      console.error('Failed to get articles:', error);
      return [];
    }
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<Article | null> {
    try {
      const row = await this.dbGet('SELECT * FROM articles WHERE id = ?', id) as DatabaseArticle | undefined;
      return row ? this.mapDatabaseToArticle(row) : null;
    } catch (error) {
      console.error('Failed to get article by ID:', error);
      return null;
    }
  }

  /**
   * Check if article exists by URL
   */
  async articleExists(url: string): Promise<boolean> {
    try {
      const row = await this.dbGet('SELECT 1 FROM articles WHERE url = ?', url);
      return row !== undefined;
    } catch (error) {
      console.error('Failed to check article existence:', error);
      return false;
    }
  }

  /**
   * Mark articles as selected for newsletter
   */
  async selectArticles(articleIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        let completed = 0;
        let hasError = false;

        for (const id of articleIds) {
          if (hasError) break;

          this.db.run('UPDATE articles SET isSelected = 1 WHERE id = ?', id, (err) => {
            if (err) {
              hasError = true;
              this.db.run('ROLLBACK', () => reject(err));
            } else {
              completed++;
              if (completed === articleIds.length) {
                this.db.run('COMMIT', (commitErr) => {
                  if (commitErr) reject(commitErr);
                  else resolve();
                });
              }
            }
          });
        }
      });
    });
  }

  /**
   * Unselect articles
   */
  async unselectArticles(articleIds: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION');
        
        let completed = 0;
        let hasError = false;

        for (const id of articleIds) {
          if (hasError) break;

          this.db.run('UPDATE articles SET isSelected = 0 WHERE id = ?', id, (err) => {
            if (err) {
              hasError = true;
              this.db.run('ROLLBACK', () => reject(err));
            } else {
              completed++;
              if (completed === articleIds.length) {
                this.db.run('COMMIT', (commitErr) => {
                  if (commitErr) reject(commitErr);
                  else resolve();
                });
              }
            }
          });
        }
      });
    });
  }

  /**
   * Get selected articles for newsletter generation
   */
  async getSelectedArticles(): Promise<Article[]> {
    try {
      const rows = await this.dbAll('SELECT * FROM articles WHERE isSelected = 1 ORDER BY publishedAt DESC') as DatabaseArticle[];
      return rows.map(row => this.mapDatabaseToArticle(row));
    } catch (error) {
      console.error('Failed to get selected articles:', error);
      return [];
    }
  }

  /**
   * Clear all selected articles
   */
  async clearSelections(): Promise<void> {
    try {
      await this.dbRun('UPDATE articles SET isSelected = 0');
    } catch (error) {
      console.error('Failed to clear selections:', error);
      throw error;
    }
  }

  /**
   * Get articles count by category
   */
  async getArticleStats(): Promise<Record<Category, number>> {
    try {
      const rows = await this.dbAll(`
        SELECT category, COUNT(*) as count 
        FROM articles 
        GROUP BY category
      `) as { category: Category; count: number }[];
      
      return {
        finance: rows.find(r => r.category === 'finance')?.count || 0,
        tech: rows.find(r => r.category === 'tech')?.count || 0
      };
    } catch (error) {
      console.error('Failed to get article stats:', error);
      return { finance: 0, tech: 0 };
    }
  }

  /**
   * Delete old articles (older than specified days)
   */
  async cleanupOldArticles(days: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    try {
      const result = await this.dbRun('DELETE FROM articles WHERE createdAt < ?', cutoffDate.toISOString());
      return result.changes || 0;
    } catch (error) {
      console.error('Failed to cleanup old articles:', error);
      return 0;
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err);
      }
    });
  }

  /**
   * RSS Feed Management Methods
   */

  /**
   * Save RSS feed subscription
   */
  async saveRSSFeed(feed: RSSFeed): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO rss_feeds (
        id, name, url, category, language, isActive,
        lastFetched, createdAt, description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.dbRun(sql,
        feed.id,
        feed.name,
        feed.url,
        feed.category,
        feed.language,
        feed.isActive ? 1 : 0,
        feed.lastFetched?.toISOString() || null,
        feed.createdAt.toISOString(),
        feed.description || null
      );
    } catch (error) {
      console.error('Failed to save RSS feed:', error);
      throw error;
    }
  }

  /**
   * Get all RSS feeds
   */
  async getRSSFeeds(activeOnly: boolean = false): Promise<RSSFeed[]> {
    let sql = 'SELECT * FROM rss_feeds';
    if (activeOnly) {
      sql += ' WHERE isActive = 1';
    }
    sql += ' ORDER BY name';

    try {
      const rows = await this.dbAll(sql) as DatabaseRSSFeed[];
      return rows.map(row => this.mapDatabaseToRSSFeed(row));
    } catch (error) {
      console.error('Failed to get RSS feeds:', error);
      return [];
    }
  }

  /**
   * Get RSS feeds by category
   */
  async getRSSFeedsByCategory(category: Category, activeOnly: boolean = true): Promise<RSSFeed[]> {
    let sql = 'SELECT * FROM rss_feeds WHERE category = ?';
    const params: any[] = [category];

    if (activeOnly) {
      sql += ' AND isActive = 1';
    }
    sql += ' ORDER BY name';

    try {
      const rows = await this.dbAll(sql, ...params) as DatabaseRSSFeed[];
      return rows.map(row => this.mapDatabaseToRSSFeed(row));
    } catch (error) {
      console.error('Failed to get RSS feeds by category:', error);
      return [];
    }
  }

  /**
   * Get RSS feed by ID
   */
  async getRSSFeedById(id: string): Promise<RSSFeed | null> {
    try {
      const row = await this.dbGet('SELECT * FROM rss_feeds WHERE id = ?', id) as DatabaseRSSFeed | undefined;
      return row ? this.mapDatabaseToRSSFeed(row) : null;
    } catch (error) {
      console.error('Failed to get RSS feed by ID:', error);
      return null;
    }
  }

  /**
   * Check if RSS feed URL exists
   */
  async rssFeedExists(url: string): Promise<boolean> {
    try {
      const row = await this.dbGet('SELECT 1 FROM rss_feeds WHERE url = ?', url);
      return row !== undefined;
    } catch (error) {
      console.error('Failed to check RSS feed existence:', error);
      return false;
    }
  }

  /**
   * Update RSS feed last fetched time
   */
  async updateRSSFeedLastFetched(id: string, lastFetched: Date): Promise<void> {
    try {
      await this.dbRun('UPDATE rss_feeds SET lastFetched = ? WHERE id = ?', 
        lastFetched.toISOString(), id);
    } catch (error) {
      console.error('Failed to update RSS feed last fetched:', error);
      throw error;
    }
  }

  /**
   * Toggle RSS feed active status
   */
  async toggleRSSFeedStatus(id: string, isActive: boolean): Promise<void> {
    try {
      await this.dbRun('UPDATE rss_feeds SET isActive = ? WHERE id = ?', 
        isActive ? 1 : 0, id);
    } catch (error) {
      console.error('Failed to toggle RSS feed status:', error);
      throw error;
    }
  }

  /**
   * Delete RSS feed
   */
  async deleteRSSFeed(id: string): Promise<void> {
    try {
      await this.dbRun('DELETE FROM rss_feeds WHERE id = ?', id);
    } catch (error) {
      console.error('Failed to delete RSS feed:', error);
      throw error;
    }
  }

  /**
   * Get RSS feed statistics
   */
  async getRSSFeedStats(): Promise<{
    total: number;
    active: number;
    byCategory: Record<Category, number>;
  }> {
    try {
      const totalRow = await this.dbGet('SELECT COUNT(*) as count FROM rss_feeds') as { count: number };
      const activeRow = await this.dbGet('SELECT COUNT(*) as count FROM rss_feeds WHERE isActive = 1') as { count: number };
      const categoryRows = await this.dbAll(`
        SELECT category, COUNT(*) as count 
        FROM rss_feeds 
        WHERE isActive = 1
        GROUP BY category
      `) as { category: Category; count: number }[];

      const byCategory: Record<Category, number> = {
        finance: categoryRows.find(r => r.category === 'finance')?.count || 0,
        tech: categoryRows.find(r => r.category === 'tech')?.count || 0,
      };

      return {
        total: totalRow.count,
        active: activeRow.count,
        byCategory
      };
    } catch (error) {
      console.error('Failed to get RSS feed stats:', error);
      return { total: 0, active: 0, byCategory: { finance: 0, tech: 0 } };
    }
  }

  /**
   * Map database row to Article object
   */
  private mapDatabaseToArticle(row: DatabaseArticle): Article {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      description: row.description,
      url: row.url,
      imageUrl: row.imageUrl,
      publishedAt: new Date(row.publishedAt),
      content: row.content,
      category: row.category as Category,
      source: row.source,
      summary: row.summary,
      language: row.language as Language,
      originalLanguage: row.originalLanguage as Language,
      isSelected: row.isSelected === 1,
      createdAt: new Date(row.createdAt)
    };
  }

  /**
   * Map database row to RSS Feed object
   */
  private mapDatabaseToRSSFeed(row: DatabaseRSSFeed): RSSFeed {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      category: row.category as Category,
      language: row.language as Language,
      isActive: row.isActive === 1,
      lastFetched: row.lastFetched ? new Date(row.lastFetched) : null,
      createdAt: new Date(row.createdAt),
      description: row.description || undefined
    };
  }
}