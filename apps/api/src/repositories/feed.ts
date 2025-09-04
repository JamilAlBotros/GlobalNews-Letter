import { BaseRepository } from './base.js';
import type { DatabaseRSSFeed } from '../types/index.js';

export interface CreateFeedData {
  id: string;
  name: string;
  url: string;
  category: string;
  language: string;
  region: string;
  type: string;
  description?: string | null;
  isActive?: boolean;
  created_at: string;
}

export interface UpdateFeedData {
  name?: string;
  url?: string;
  category?: string;
  language?: string;
  description?: string | null;
  isActive?: boolean;
  lastFetched?: string | null;
}

/**
 * RSS Feed repository for database operations
 * Adapted from archive with enhanced functionality
 */
export class FeedRepository extends BaseRepository {

  /**
   * Find feed by ID
   */
  async findById(id: string): Promise<DatabaseRSSFeed | null> {
    return await this.executeQuery<DatabaseRSSFeed>(
      'find_feed_by_id',
      'SELECT * FROM feeds WHERE id = $1',
      [id]
    );
  }

  /**
   * Find feed by URL
   */
  async findByUrl(url: string): Promise<DatabaseRSSFeed | null> {
    return await this.executeQuery<DatabaseRSSFeed>(
      'find_feed_by_url',
      'SELECT * FROM feeds WHERE url = $1',
      [url]
    );
  }

  /**
   * Find all feeds
   */
  async findAll(): Promise<DatabaseRSSFeed[]> {
    return await this.executeQueryAll<DatabaseRSSFeed>(
      'find_all_feeds',
      'SELECT * FROM feeds ORDER BY name ASC'
    );
  }

  /**
   * Find active feeds only
   */
  async findActive(): Promise<DatabaseRSSFeed[]> {
    return await this.executeQueryAll<DatabaseRSSFeed>(
      'find_active_feeds',
      'SELECT *, updated_at as last_fetched FROM feeds WHERE is_active = true ORDER BY name ASC'
    );
  }

  /**
   * Find feeds by category
   */
  async findByCategory(category: string): Promise<DatabaseRSSFeed[]> {
    return await this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_by_category',
      'SELECT * FROM feeds WHERE category = $1 ORDER BY name ASC',
      [category]
    );
  }

  /**
   * Find feeds by language
   */
  async findByLanguage(language: string): Promise<DatabaseRSSFeed[]> {
    return await this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_by_language',
      'SELECT * FROM feeds WHERE language = $1 ORDER BY name ASC',
      [language]
    );
  }

  /**
   * Find feeds that need updating (haven't been fetched recently)
   */
  async findNeedingUpdate(hoursThreshold: number = 1): Promise<DatabaseRSSFeed[]> {
    return await this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_needing_update',
      `SELECT * FROM feeds 
       WHERE is_active = true 
       AND (
         last_fetched IS NULL 
         OR last_fetched < NOW() - INTERVAL '$1 hours'
       )
       ORDER BY last_fetched ASC NULLS FIRST`,
      [hoursThreshold]
    );
  }

  /**
   * Create new feed
   */
  async create(data: CreateFeedData): Promise<string> {
    const query = `
      INSERT INTO feeds (
        id, name, url, language, region, category, type, description,
        is_active, last_fetched, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, $10, $11)
    `;

    await this.executeCommand(
      'create_feed',
      query,
      [
        data.id,
        data.name,
        data.url,
        data.language,
        data.region,
        data.category,
        data.type,
        data.description || null,
        data.isActive !== false ? 1 : 0, // Default to active
        data.created_at,
        data.created_at
      ]
    );

    return data.id;
  }

  /**
   * Update existing feed
   */
  async update(id: string, data: UpdateFeedData): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push(`name = $${params.length + 1}`);
      params.push(data.name);
    }

    if (data.url !== undefined) {
      updates.push(`url = $${params.length + 1}`);
      params.push(data.url);
    }

    if (data.category !== undefined) {
      updates.push(`category = $${params.length + 1}`);
      params.push(data.category);
    }

    if (data.language !== undefined) {
      updates.push(`language = $${params.length + 1}`);
      params.push(data.language);
    }

    if (data.description !== undefined) {
      updates.push(`description = $${params.length + 1}`);
      params.push(data.description);
    }

    if (data.isActive !== undefined) {
      updates.push(`is_active = $${params.length + 1}`);
      params.push(data.isActive ? 1 : 0);
    }

    if (data.lastFetched !== undefined) {
      updates.push(`last_fetched = $${params.length + 1}`);
      params.push(data.lastFetched);
    }

    if (updates.length === 0) {
      return false;
    }

    // Always update the updated_at timestamp
    updates.push(`updated_at = $${params.length + 1}`);
    params.push(new Date().toISOString());

    params.push(id);
    const query = `UPDATE feeds SET ${updates.join(', ')} WHERE id = $${params.length}`;

    const result = await this.executeCommand('update_feed', query, params);
    return result.changes > 0;
  }

  /**
   * Update feed's last fetched timestamp
   */
  async updateLastFetched(id: string): Promise<boolean> {
    const result = await this.executeCommand(
      'update_feed_last_fetched',
      'UPDATE feeds SET updated_at = $1 WHERE id = $2',
      [new Date().toISOString(), id]
    );
    return result.changes > 0;
  }

  /**
   * Toggle feed active status
   */
  async toggleActive(id: string): Promise<boolean> {
    const feed = await this.findById(id);
    if (!feed) return false;

    return await this.update(id, { isActive: feed.is_active === 0 });
  }

  /**
   * Delete feed
   */
  async delete(id: string): Promise<boolean> {
    const result = await this.executeCommand(
      'delete_feed',
      'DELETE FROM feeds WHERE id = $1',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Check if feed exists by URL
   */
  async existsByUrl(url: string): Promise<boolean> {
    return this.exists(
      'feed_exists_by_url',
      'SELECT 1 FROM feeds WHERE url = $1',
      [url]
    );
  }

  /**
   * Get feed statistics
   */
  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
    byLanguage: Record<string, number>;
    recentlyFetched: number;
  }> {
    const total = await this.count('total_feeds', 'SELECT COUNT(*) as count FROM feeds');
    const active = await this.count('active_feeds', 'SELECT COUNT(*) as count FROM feeds WHERE is_active = true');
    const inactive = total - active;

    const categoryStats = await this.executeQueryAll<{ category: string; count: number }>(
      'feeds_by_category',
      'SELECT category, COUNT(*) as count FROM feeds GROUP BY category'
    );

    const languageStats = await this.executeQueryAll<{ language: string; count: number }>(
      'feeds_by_language',
      'SELECT language, COUNT(*) as count FROM feeds GROUP BY language'
    );

    const byCategory = categoryStats.reduce((acc, stat) => {
      acc[stat.category] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    const byLanguage = languageStats.reduce((acc, stat) => {
      acc[stat.language] = stat.count;
      return acc;
    }, {} as Record<string, number>);

    // Calculate 24 hours ago in ISO format
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentlyFetched = await this.executeQuery(
      'recently_fetched_feeds',
      'SELECT COUNT(*) as count FROM feeds WHERE last_fetched > $1',
      [twentyFourHoursAgo]
    ) as { count: number } | null;

    return {
      total,
      active,
      inactive,
      byCategory,
      byLanguage,
      recentlyFetched: recentlyFetched?.count || 0
    };
  }

  /**
   * Get feeds with article counts
   */
  async findWithArticleCounts(): Promise<Array<DatabaseRSSFeed & { article_count: number }>> {
    return await this.executeQueryAll<DatabaseRSSFeed & { article_count: number }>(
      'feeds_with_article_counts',
      `SELECT f.*, COUNT(a.id) as article_count
       FROM feeds f
       LEFT JOIN articles a ON f.id = a.feed_id
       GROUP BY f.id
       ORDER BY f.name ASC`
    );
  }

  /**
   * Find feeds by multiple criteria
   */
  async findByCriteria(criteria: {
    category?: string;
    language?: string;
    isActive?: boolean;
    hasRecentArticles?: boolean;
  }): Promise<DatabaseRSSFeed[]> {
    let query = 'SELECT DISTINCT f.* FROM feeds f';
    const params: any[] = [];
    const conditions: string[] = [];

    if (criteria.hasRecentArticles) {
      query += ' LEFT JOIN articles a ON f.id = a.feed_id';
      conditions.push('a.created_at > datetime(\'now\', \'-7 days\')');
    }

    if (criteria.category) {
      conditions.push(`f.category = $${params.length + 1}`);
      params.push(criteria.category);
    }

    if (criteria.language) {
      conditions.push(`f.language = $${params.length + 1}`);
      params.push(criteria.language);
    }

    if (criteria.isActive !== undefined) {
      conditions.push(`f.is_active = $${params.length + 1}`);
      params.push(criteria.isActive ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY f.name ASC';

    return await this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_by_criteria',
      query,
      params
    );
  }

  /**
   * Batch update multiple feeds
   */
  async batchUpdate(updates: Array<{ id: string; data: UpdateFeedData }>): Promise<number> {
    let totalChanges = 0;
    for (const { id, data } of updates) {
      const updated = await this.update(id, data);
      if (updated) {
        totalChanges++;
      }
    }
    return totalChanges;
  }
}