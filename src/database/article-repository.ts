import { BaseRepository } from './base-repository.js';
import { ErrorHandler, DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import { DatabaseArticleSchema, type DatabaseFilterOptions } from '../types/database.js';
import type { 
  Article, 
  Category
} from '../types/index.js';
import type { DatabaseArticle } from '../types/database.js';

/**
 * Repository for article database operations
 * Handles all SQL operations for articles table
 */
export class ArticleRepository extends BaseRepository {
  constructor() {
    super('articles');
  }

  /**
   * Initialize articles table with proper schema
   */
  async initialize(): Promise<void> {
    return ErrorHandler.withErrorHandling(
      async () => {
        const connection = await this.getConnection();
        
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
            source TEXT,
            summary TEXT,
            language TEXT NOT NULL,
            originalLanguage TEXT NOT NULL,
            isSelected INTEGER DEFAULT 0,
            createdAt TEXT NOT NULL,
            updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
          );
        `;

        const createIndexes = `
          CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
          CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(language);
          CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(publishedAt);
          CREATE INDEX IF NOT EXISTS idx_articles_url ON articles(url);
          CREATE INDEX IF NOT EXISTS idx_articles_selected ON articles(isSelected);
          CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(createdAt);
        `;

        await connection.exec(createArticlesTable);
        await connection.exec(createIndexes);
        
        console.log('Articles table and indexes initialized successfully');
      },
      'ArticleRepository.initialize'
    );
  }

  /**
   * Save a single article
   */
  async saveArticle(article: Article): Promise<void> {
    if (!article || !article.id || !article.url) {
      throw new ValidationError('Valid article with ID and URL is required');
    }

    return this.withConnection(async (connection) => {
      const sql = `
        INSERT OR REPLACE INTO articles (
          id, title, author, description, url, imageUrl, publishedAt,
          content, category, source, summary, language, originalLanguage,
          isSelected, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const params = [
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
      ];

      await connection.run(sql, ...params);
    });
  }

  /**
   * Save multiple articles in a transaction
   */
  async saveArticles(articles: Article[]): Promise<void> {
    if (!Array.isArray(articles) || articles.length === 0) {
      throw new ValidationError('Valid articles array is required');
    }

    return this.withTransaction(async (connection) => {
      const sql = `
        INSERT OR REPLACE INTO articles (
          id, title, author, description, url, imageUrl, publishedAt,
          content, category, source, summary, language, originalLanguage,
          isSelected, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      for (const article of articles) {
        if (!article.id || !article.url) {
          throw new ValidationError(`Invalid article: ${article.title || 'Unknown'}`);
        }

        const params = [
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
        ];

        await connection.run(sql, ...params);
      }
    });
  }

  /**
   * Get articles with optional filtering
   */
  async getArticles(filters: Partial<DatabaseFilterOptions> = {}): Promise<Article[]> {
    return this.withConnection(async (connection) => {
      let sql = 'SELECT * FROM articles';
      const params: any[] = [];
      const whereClauses: string[] = [];

      // Apply filters
      if (filters.category) {
        whereClauses.push('category = ?');
        params.push(filters.category);
      }

      if (filters.language) {
        whereClauses.push('language = ?');
        params.push(filters.language);
      }

      if (filters.isSelected !== undefined) {
        whereClauses.push('isSelected = ?');
        params.push(filters.isSelected ? 1 : 0);
      }

      if (filters.keyword) {
        whereClauses.push('(title LIKE ? OR description LIKE ? OR content LIKE ?)');
        const searchTerm = `%${filters.keyword}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (filters.fromDate) {
        whereClauses.push('publishedAt >= ?');
        params.push(filters.fromDate instanceof Date ? filters.fromDate.toISOString() : filters.fromDate);
      }

      if (filters.toDate) {
        whereClauses.push('publishedAt <= ?');
        params.push(filters.toDate instanceof Date ? filters.toDate.toISOString() : filters.toDate);
      }

      // Build WHERE clause
      if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      // Add sorting
      const sortBy = filters.sortBy || 'publishedAt';
      const sortOrder = filters.sortOrder || 'DESC';
      sql += ` ORDER BY ${sortBy} ${sortOrder}`;

      // Add pagination
      if (filters.limit) {
        sql += ` LIMIT ${filters.limit}`;
        if (filters.offset) {
          sql += ` OFFSET ${filters.offset}`;
        }
      }

      const rows = await connection.all(sql, ...params);
      return rows.map(row => this.mapDatabaseToArticle(row));
    });
  }

  /**
   * Get article by ID
   */
  async getArticleById(articleId: string): Promise<Article | null> {
    if (!articleId) {
      throw new ValidationError('Article ID is required');
    }

    return this.withConnection(async (connection) => {
      const sql = 'SELECT * FROM articles WHERE id = ?';
      const row = await connection.get(sql, articleId);
      
      if (!row) {
        return null;
      }

      return this.mapDatabaseToArticle(row);
    });
  }

  /**
   * Check if article exists by URL
   */
  async articleExists(url: string): Promise<boolean> {
    if (!url) {
      throw new ValidationError('URL is required');
    }

    return this.recordExists('articles', 'url', url);
  }

  /**
   * Update article selection status
   */
  async updateSelectionStatus(articleIds: string[], isSelected: boolean): Promise<void> {
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      throw new ValidationError('Article IDs array is required');
    }

    return this.withConnection(async (connection) => {
      const placeholders = this.preparePlaceholders(articleIds.length);
      const sql = `UPDATE articles SET isSelected = ?, updatedAt = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
      const params = [isSelected ? 1 : 0, ...articleIds];
      
      await connection.run(sql, ...params);
    });
  }

  /**
   * Get selected articles
   */
  async getSelectedArticles(): Promise<Article[]> {
    return this.getArticles({ isSelected: true });
  }

  /**
   * Clear all selections
   */
  async clearAllSelections(): Promise<void> {
    return this.withConnection(async (connection) => {
      const sql = 'UPDATE articles SET isSelected = 0, updatedAt = CURRENT_TIMESTAMP';
      await connection.run(sql);
    });
  }

  /**
   * Get article statistics by category
   */
  async getArticleStats(): Promise<Record<Category, number>> {
    return this.withConnection(async (connection) => {
      const sql = 'SELECT category, COUNT(*) as count FROM articles GROUP BY category';
      const rows = await connection.all(sql);
      
      const stats: Record<string, number> = {};
      rows.forEach(row => {
        stats[row.category] = row.count;
      });
      
      return stats as Record<Category, number>;
    });
  }

  /**
   * Delete old articles
   */
  async cleanupOldArticles(days: number = 30): Promise<number> {
    if (days <= 0) {
      throw new ValidationError('Days must be a positive number');
    }

    return this.withConnection(async (connection) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      const sql = 'DELETE FROM articles WHERE createdAt < ?';
      const result = await connection.run(sql, cutoffDate.toISOString());
      
      return result.changes || 0;
    });
  }

  /**
   * Get total article count
   */
  async getTotalCount(): Promise<number> {
    return this.countRecords('articles');
  }

  /**
   * Get valid sort fields for articles
   */
  protected override getValidSortFields(): string[] {
    return [
      'id', 'title', 'author', 'publishedAt', 'createdAt', 
      'category', 'language', 'source', 'isSelected'
    ];
  }

  /**
   * Map database row to Article object
   */
  private mapDatabaseToArticle(row: DatabaseArticle): Article {
    // Validate database row
    const validatedRow = DatabaseArticleSchema.parse(row);
    
    return {
      id: validatedRow.id,
      title: validatedRow.title,
      author: validatedRow.author,
      description: validatedRow.description,
      url: validatedRow.url,
      imageUrl: validatedRow.imageUrl,
      publishedAt: new Date(validatedRow.publishedAt),
      content: validatedRow.content,
      category: validatedRow.category as Category,
      source: validatedRow.source || '',
      summary: validatedRow.summary,
      language: validatedRow.language as any,
      originalLanguage: validatedRow.originalLanguage as any,
      isSelected: validatedRow.isSelected === 1,
      createdAt: new Date(validatedRow.createdAt)
    };
  }
}