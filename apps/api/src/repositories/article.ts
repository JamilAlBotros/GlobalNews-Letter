import { BaseRepository } from './base.js';
import type { DatabaseArticle, DatabaseFilterOptions } from '../types/index.js';

export interface CreateArticleData {
  id: string;
  feed_id: string;
  title: string;
  description?: string | null;
  content?: string | null;
  url: string;
  detected_language?: string | null;
  needs_manual_language_review?: boolean;
  summary?: string | null;
  original_language?: string | null;
  published_at?: string | null;
  scraped_at: string;
  created_at: string;
}

export interface UpdateArticleData {
  title?: string;
  description?: string | null;
  content?: string | null;
  detected_language?: string | null;
  needs_manual_language_review?: boolean;
  summary?: string | null;
  original_language?: string | null;
}

/**
 * Article repository for database operations
 * Adapted from archive with enhanced error handling
 */
export class ArticleRepository extends BaseRepository {

  /**
   * Find article by ID
   */
  findById(id: string): DatabaseArticle | null {
    return this.executeQuery<DatabaseArticle>(
      'find_article_by_id',
      'SELECT * FROM articles WHERE id = ?',
      [id]
    );
  }

  /**
   * Find article by URL
   */
  findByUrl(url: string): DatabaseArticle | null {
    return this.executeQuery<DatabaseArticle>(
      'find_article_by_url',
      'SELECT * FROM articles WHERE url = ?',
      [url]
    );
  }

  /**
   * Find articles with filtering and pagination
   */
  findMany(options: DatabaseFilterOptions = { sortBy: 'publishedAt' }): DatabaseArticle[] {
    const {
      categories,
      dateFrom,
      dateTo,
      sources,
      language,
      keyword,
      sortBy = 'publishedAt',
      limit = 50,
      offset = 0
    } = options;

    let query = `
      SELECT a.* 
      FROM articles a 
      LEFT JOIN feeds f ON a.feed_id = f.id 
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => '?').join(',');
      query += ` AND f.category IN (${placeholders})`;
      params.push(...categories);
    }

    if (language) {
      query += ` AND a.language = ?`;
      params.push(language);
    }

    if (sources && sources.length > 0) {
      const placeholders = sources.map(() => '?').join(',');
      query += ` AND f.name IN (${placeholders})`;
      params.push(...sources);
    }

    if (dateFrom) {
      query += ` AND a.published_at >= ?`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND a.published_at <= ?`;
      params.push(dateTo);
    }

    if (keyword) {
      query += ` AND (a.title LIKE ? OR a.description LIKE ? OR a.content LIKE ?)`;
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern);
    }

    // Sorting
    const sortColumn = sortBy === 'publishedAt' ? 'a.published_at' : 
                      sortBy === 'popularity' ? 'a.created_at' : 
                      'a.created_at';
    query += ` ORDER BY ${sortColumn} DESC`;

    // Pagination
    query += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    return this.executeQueryAll<DatabaseArticle>(
      'find_articles_with_filters',
      query,
      params
    );
  }

  /**
   * Count articles matching filters
   */
  countMany(options: DatabaseFilterOptions = { sortBy: 'publishedAt' }): number {
    const {
      categories,
      dateFrom,
      dateTo,
      sources,
      language,
      keyword
    } = options;

    let query = `
      SELECT COUNT(*) as count 
      FROM articles a 
      LEFT JOIN feeds f ON a.feed_id = f.id 
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (categories && categories.length > 0) {
      const placeholders = categories.map(() => '?').join(',');
      query += ` AND f.category IN (${placeholders})`;
      params.push(...categories);
    }

    if (language) {
      query += ` AND a.language = ?`;
      params.push(language);
    }

    if (sources && sources.length > 0) {
      const placeholders = sources.map(() => '?').join(',');
      query += ` AND f.name IN (${placeholders})`;
      params.push(...sources);
    }

    if (dateFrom) {
      query += ` AND a.published_at >= ?`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND a.published_at <= ?`;
      params.push(dateTo);
    }

    if (keyword) {
      query += ` AND (a.title LIKE ? OR a.description LIKE ? OR a.content LIKE ?)`;
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern);
    }

    return this.count('count_articles_with_filters', query, params);
  }

  /**
   * Find articles by feed ID
   */
  findByFeedId(feedId: string, limit: number = 50): DatabaseArticle[] {
    return this.executeQueryAll<DatabaseArticle>(
      'find_articles_by_feed',
      'SELECT * FROM articles WHERE feed_id = ? ORDER BY published_at DESC LIMIT ?',
      [feedId, limit]
    );
  }

  /**
   * Find articles that need manual language review
   */
  findNeedingLanguageReview(limit: number = 50): DatabaseArticle[] {
    return this.executeQueryAll<DatabaseArticle>(
      'find_articles_needing_review',
      'SELECT * FROM articles WHERE needs_manual_language_review = 1 ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
  }

  /**
   * Create new article
   */
  create(data: CreateArticleData): string {
    const query = `
      INSERT INTO articles (
        id, feed_id, title, description, content, url,
        detected_language, needs_manual_language_review,
        summary, original_language,
        published_at, scraped_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.executeCommand(
      'create_article',
      query,
      [
        data.id,
        data.feed_id,
        data.title,
        data.description || null,
        data.content || null,
        data.url,
        data.detected_language || null,
        data.needs_manual_language_review ? 1 : 0,
        data.summary || null,
        data.original_language || null,
        data.published_at || new Date().toISOString(),
        data.scraped_at,
        data.created_at
      ]
    );

    return data.id;
  }

  /**
   * Update existing article
   */
  update(id: string, data: UpdateArticleData): boolean {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push('title = ?');
      params.push(data.title);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.content !== undefined) {
      updates.push('content = ?');
      params.push(data.content);
    }

    if (data.detected_language !== undefined) {
      updates.push('detected_language = ?');
      params.push(data.detected_language);
    }

    if (data.needs_manual_language_review !== undefined) {
      updates.push('needs_manual_language_review = ?');
      params.push(data.needs_manual_language_review ? 1 : 0);
    }

    if (data.summary !== undefined) {
      updates.push('summary = ?');
      params.push(data.summary);
    }

    if (data.original_language !== undefined) {
      updates.push('original_language = ?');
      params.push(data.original_language);
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(id);
    const query = `UPDATE articles SET ${updates.join(', ')} WHERE id = ?`;

    const result = this.executeCommand('update_article', query, params);
    return result.changes > 0;
  }

  /**
   * Delete article by ID
   */
  delete(id: string): boolean {
    const result = this.executeCommand(
      'delete_article',
      'DELETE FROM articles WHERE id = ?',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Check if article exists by URL
   */
  existsByUrl(url: string): boolean {
    return this.exists(
      'article_exists_by_url',
      'SELECT 1 FROM articles WHERE url = ?',
      [url]
    );
  }

  /**
   * Get recent articles for a language
   */
  findRecentByLanguage(language: string, limit: number = 10): DatabaseArticle[] {
    return this.executeQueryAll<DatabaseArticle>(
      'find_recent_articles_by_language',
      'SELECT * FROM articles WHERE detected_language = ? ORDER BY published_at DESC LIMIT ?',
      [language, limit]
    );
  }

  /**
   * Get articles statistics
   */
  getStatistics(): {
    total: number;
    byLanguage: Record<string, number>;
    needingReview: number;
    recentCount: number;
  } {
    const total = this.count('total_articles', 'SELECT COUNT(*) as count FROM articles');

    const languageStats = this.executeQueryAll<{ language: string; count: number }>(
      'articles_by_language',
      'SELECT detected_language as language, COUNT(*) as count FROM articles WHERE detected_language IS NOT NULL GROUP BY detected_language'
    );

    const byLanguage = languageStats.reduce((acc, stat) => {
      acc[stat.language] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    const needingReview = this.count(
      'articles_needing_review',
      'SELECT COUNT(*) as count FROM articles WHERE needs_manual_language_review = 1'
    );

    const recentCount = this.count(
      'recent_articles',
      'SELECT COUNT(*) as count FROM articles WHERE created_at > datetime(\'now\', \'-7 days\')'
    );

    return {
      total,
      byLanguage,
      needingReview,
      recentCount
    };
  }
}