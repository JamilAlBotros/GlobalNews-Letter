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
  async findById(id: string): Promise<DatabaseArticle | null> {
    return await this.executeQuery<DatabaseArticle>(
      'find_article_by_id',
      'SELECT * FROM articles WHERE id = $1',
      [id]
    );
  }

  /**
   * Find article by URL
   */
  async findByUrl(url: string): Promise<DatabaseArticle | null> {
    return await this.executeQuery<DatabaseArticle>(
      'find_article_by_url',
      'SELECT * FROM articles WHERE url = $1',
      [url]
    );
  }

  /**
   * Find articles with filtering and pagination
   */
  async findMany(options: DatabaseFilterOptions = { sortBy: 'publishedAt' }): Promise<DatabaseArticle[]> {
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

    // If no filters are provided, use a simple query
    if (!categories && !dateFrom && !dateTo && !sources && !language && !keyword) {
      const sortColumn = sortBy === 'publishedAt' ? 'published_at' : 
                        sortBy === 'popularity' ? 'created_at' : 
                        'created_at';
      
      return this.executeQueryAll<DatabaseArticle>(
        'find_articles_simple',
        `SELECT * FROM articles ORDER BY ${sortColumn} DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
    }

    // Complex query with filters
    let query = `
      SELECT a.* 
      FROM articles a 
      LEFT JOIN feeds f ON a.feed_id = f.id 
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (categories && categories.length > 0) {
      const placeholders = categories.map((_, i) => `$${params.length + i + 1}`).join(',');
      query += ` AND f.category IN (${placeholders})`;
      params.push(...categories);
    }

    if (language) {
      query += ` AND a.language = $${params.length + 1}`;
      params.push(language);
    }

    if (sources && sources.length > 0) {
      const placeholders = sources.map((_, i) => `$${params.length + i + 1}`).join(',');
      query += ` AND f.name IN (${placeholders})`;
      params.push(...sources);
    }

    if (dateFrom) {
      query += ` AND a.published_at >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND a.published_at <= $${params.length + 1}`;
      params.push(dateTo);
    }

    if (keyword) {
      query += ` AND (a.title LIKE $${params.length + 1} OR a.description LIKE $${params.length + 2} OR a.content LIKE $${params.length + 3})`;
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern);
    }

    // Sorting
    const sortColumn = sortBy === 'publishedAt' ? 'a.published_at' : 
                      sortBy === 'popularity' ? 'a.created_at' : 
                      'a.created_at';
    query += ` ORDER BY ${sortColumn} DESC`;

    // Pagination
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
  async countMany(options: DatabaseFilterOptions = { sortBy: 'publishedAt' }): Promise<number> {
    const {
      categories,
      dateFrom,
      dateTo,
      sources,
      language,
      keyword
    } = options;

    // If no filters are provided, use a simple count
    if (!categories && !dateFrom && !dateTo && !sources && !language && !keyword) {
      return await this.count('count_articles_simple', 'SELECT COUNT(*) as count FROM articles');
    }

    let query = `
      SELECT COUNT(*) as count 
      FROM articles a 
      LEFT JOIN feeds f ON a.feed_id = f.id 
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (categories && categories.length > 0) {
      const placeholders = categories.map((_, i) => `$${params.length + i + 1}`).join(',');
      query += ` AND f.category IN (${placeholders})`;
      params.push(...categories);
    }

    if (language) {
      query += ` AND a.language = $${params.length + 1}`;
      params.push(language);
    }

    if (sources && sources.length > 0) {
      const placeholders = sources.map((_, i) => `$${params.length + i + 1}`).join(',');
      query += ` AND f.name IN (${placeholders})`;
      params.push(...sources);
    }

    if (dateFrom) {
      query += ` AND a.published_at >= $${params.length + 1}`;
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ` AND a.published_at <= $${params.length + 1}`;
      params.push(dateTo);
    }

    if (keyword) {
      query += ` AND (a.title LIKE $${params.length + 1} OR a.description LIKE $${params.length + 2} OR a.content LIKE $${params.length + 3})`;
      const keywordPattern = `%${keyword}%`;
      params.push(keywordPattern, keywordPattern, keywordPattern);
    }

    return await this.count('count_articles_with_filters', query, params);
  }

  /**
   * Find articles by feed ID
   */
  async findByFeedId(feedId: string, limit: number = 50): Promise<DatabaseArticle[]> {
    return await this.executeQueryAll<DatabaseArticle>(
      'find_articles_by_feed',
      'SELECT * FROM articles WHERE feed_id = $1 ORDER BY published_at DESC LIMIT $2',
      [feedId, limit]
    );
  }

  /**
   * Find articles that need manual language review
   */
  async findNeedingLanguageReview(limit: number = 50): Promise<DatabaseArticle[]> {
    return await this.executeQueryAll<DatabaseArticle>(
      'find_articles_needing_review',
      'SELECT * FROM articles WHERE needs_manual_language_review = 1 ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
  }

  /**
   * Create new article
   */
  async create(data: CreateArticleData): Promise<string> {
    const query = `
      INSERT INTO articles (
        id, feed_id, title, description, content, url,
        detected_language, needs_manual_language_review,
        summary, original_language,
        published_at, scraped_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    await this.executeCommand(
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
  async update(id: string, data: UpdateArticleData): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updates.push(`title = $${params.length + 1}`);
      params.push(data.title);
    }

    if (data.description !== undefined) {
      updates.push(`description = $${params.length + 1}`);
      params.push(data.description);
    }

    if (data.content !== undefined) {
      updates.push(`content = $${params.length + 1}`);
      params.push(data.content);
    }

    if (data.detected_language !== undefined) {
      updates.push(`detected_language = $${params.length + 1}`);
      params.push(data.detected_language);
    }

    if (data.needs_manual_language_review !== undefined) {
      updates.push(`needs_manual_language_review = $${params.length + 1}`);
      params.push(data.needs_manual_language_review ? 1 : 0);
    }

    if (data.summary !== undefined) {
      updates.push(`summary = $${params.length + 1}`);
      params.push(data.summary);
    }

    if (data.original_language !== undefined) {
      updates.push(`original_language = $${params.length + 1}`);
      params.push(data.original_language);
    }

    if (updates.length === 0) {
      return false;
    }

    params.push(id);
    const query = `UPDATE articles SET ${updates.join(', ')} WHERE id = $${params.length}`;

    const result = await this.executeCommand('update_article', query, params);
    return result.changes > 0;
  }

  /**
   * Delete article by ID
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.executeCommand(
      'delete_article',
      'DELETE FROM articles WHERE id = $1',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Check if article exists by URL
   */
  async existsByUrl(url: string): Promise<boolean> {
    return await this.exists(
      'article_exists_by_url',
      'SELECT 1 FROM articles WHERE url = $1',
      [url]
    );
  }

  /**
   * Get recent articles for a language
   */
  async findRecentByLanguage(language: string, limit: number = 10): Promise<DatabaseArticle[]> {
    return await this.executeQueryAll<DatabaseArticle>(
      'find_recent_articles_by_language',
      'SELECT * FROM articles WHERE detected_language = $1 ORDER BY published_at DESC LIMIT $2',
      [language, limit]
    );
  }

  /**
   * Get articles statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byLanguage: Record<string, number>;
    needingReview: number;
    recentCount: number;
  }> {
    const total = await this.count('total_articles', 'SELECT COUNT(*) as count FROM articles');

    const languageStats = await this.executeQueryAll<{ language: string; count: number }>(
      'articles_by_language',
      'SELECT detected_language as language, COUNT(*) as count FROM articles WHERE detected_language IS NOT NULL GROUP BY detected_language'
    );

    const byLanguage = languageStats.reduce((acc, stat) => {
      acc[stat.language] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    const needingReview = await this.count(
      'articles_needing_review',
      'SELECT COUNT(*) as count FROM articles WHERE needs_manual_language_review = 1'
    );

    const recentCount = await this.count(
      'recent_articles',
      'SELECT COUNT(*) as count FROM articles WHERE created_at > NOW() - INTERVAL \'7 days\''
    );

    return {
      total,
      byLanguage,
      needingReview,
      recentCount
    };
  }
}