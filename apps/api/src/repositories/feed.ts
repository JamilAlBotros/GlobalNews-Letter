import { BaseRepository } from './base.js';
import type { DatabaseRSSFeed } from '../types/index.js';

export interface CreateFeedData {
  id: string;
  name: string;
  url: string;
  category: string;
  language: string;
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
  findById(id: string): DatabaseRSSFeed | null {
    return this.executeQuery<DatabaseRSSFeed>(
      'find_feed_by_id',
      'SELECT * FROM feeds WHERE id = ?',
      [id]
    );
  }

  /**
   * Find feed by URL
   */
  findByUrl(url: string): DatabaseRSSFeed | null {
    return this.executeQuery<DatabaseRSSFeed>(
      'find_feed_by_url',
      'SELECT * FROM feeds WHERE url = ?',
      [url]
    );
  }

  /**
   * Find all feeds
   */
  findAll(): DatabaseRSSFeed[] {
    return this.executeQueryAll<DatabaseRSSFeed>(
      'find_all_feeds',
      'SELECT * FROM feeds ORDER BY name ASC'
    );
  }

  /**
   * Find active feeds only
   */
  findActive(): DatabaseRSSFeed[] {
    return this.executeQueryAll<DatabaseRSSFeed>(
      'find_active_feeds',
      'SELECT *, updated_at as last_fetched FROM feeds WHERE is_active = 1 ORDER BY name ASC'
    );
  }

  /**
   * Find feeds by category
   */
  findByCategory(category: string): DatabaseRSSFeed[] {
    return this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_by_category',
      'SELECT * FROM feeds WHERE category = ? ORDER BY name ASC',
      [category]
    );
  }

  /**
   * Find feeds by language
   */
  findByLanguage(language: string): DatabaseRSSFeed[] {
    return this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_by_language',
      'SELECT * FROM feeds WHERE language = ? ORDER BY name ASC',
      [language]
    );
  }

  /**
   * Find feeds that need updating (haven't been fetched recently)
   */
  findNeedingUpdate(hoursThreshold: number = 1): DatabaseRSSFeed[] {
    return this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_needing_update',
      `SELECT * FROM feeds 
       WHERE is_active = 1 
       AND (
         last_fetched IS NULL 
         OR last_fetched < datetime('now', '-' || ? || ' hours')
       )
       ORDER BY last_fetched ASC NULLS FIRST`,
      [hoursThreshold]
    );
  }

  /**
   * Create new feed
   */
  create(data: CreateFeedData): string {
    const query = `
      INSERT INTO feeds (
        id, name, url, category, language, description, 
        is_active, last_fetched, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `;

    this.executeCommand(
      'create_feed',
      query,
      [
        data.id,
        data.name,
        data.url,
        data.category,
        data.language,
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
  update(id: string, data: UpdateFeedData): boolean {
    const updates: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }

    if (data.url !== undefined) {
      updates.push('url = ?');
      params.push(data.url);
    }

    if (data.category !== undefined) {
      updates.push('category = ?');
      params.push(data.category);
    }

    if (data.language !== undefined) {
      updates.push('language = ?');
      params.push(data.language);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }

    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    if (data.lastFetched !== undefined) {
      updates.push('last_fetched = ?');
      params.push(data.lastFetched);
    }

    if (updates.length === 0) {
      return false;
    }

    // Always update the updated_at timestamp
    updates.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);
    const query = `UPDATE feeds SET ${updates.join(', ')} WHERE id = ?`;

    const result = this.executeCommand('update_feed', query, params);
    return result.changes > 0;
  }

  /**
   * Update feed's last fetched timestamp
   */
  updateLastFetched(id: string): boolean {
    const result = this.executeCommand(
      'update_feed_last_fetched',
      'UPDATE feeds SET updated_at = ? WHERE id = ?',
      [new Date().toISOString(), id]
    );
    return result.changes > 0;
  }

  /**
   * Toggle feed active status
   */
  toggleActive(id: string): boolean {
    const feed = this.findById(id);
    if (!feed) return false;

    return this.update(id, { isActive: feed.is_active === 0 });
  }

  /**
   * Delete feed
   */
  delete(id: string): boolean {
    const result = this.executeCommand(
      'delete_feed',
      'DELETE FROM feeds WHERE id = ?',
      [id]
    );
    return result.changes > 0;
  }

  /**
   * Check if feed exists by URL
   */
  existsByUrl(url: string): boolean {
    return this.exists(
      'feed_exists_by_url',
      'SELECT 1 FROM feeds WHERE url = ?',
      [url]
    );
  }

  /**
   * Get feed statistics
   */
  getStatistics(): {
    total: number;
    active: number;
    inactive: number;
    byCategory: Record<string, number>;
    byLanguage: Record<string, number>;
    recentlyFetched: number;
  } {
    const total = this.count('total_feeds', 'SELECT COUNT(*) as count FROM feeds');
    const active = this.count('active_feeds', 'SELECT COUNT(*) as count FROM feeds WHERE is_active = 1');
    const inactive = total - active;

    const categoryStats = this.executeQueryAll<{ category: string; count: number }>(
      'feeds_by_category',
      'SELECT category, COUNT(*) as count FROM feeds GROUP BY category'
    );

    const languageStats = this.executeQueryAll<{ language: string; count: number }>(
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

    const recentlyFetched = this.count(
      'recently_fetched_feeds',
      'SELECT COUNT(*) as count FROM feeds WHERE last_fetched > datetime("now", "-24 hours")'
    );

    return {
      total,
      active,
      inactive,
      byCategory,
      byLanguage,
      recentlyFetched
    };
  }

  /**
   * Get feeds with article counts
   */
  findWithArticleCounts(): Array<DatabaseRSSFeed & { article_count: number }> {
    return this.executeQueryAll<DatabaseRSSFeed & { article_count: number }>(
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
  findByCriteria(criteria: {
    category?: string;
    language?: string;
    isActive?: boolean;
    hasRecentArticles?: boolean;
  }): DatabaseRSSFeed[] {
    let query = 'SELECT DISTINCT f.* FROM feeds f';
    const params: any[] = [];
    const conditions: string[] = [];

    if (criteria.hasRecentArticles) {
      query += ' LEFT JOIN articles a ON f.id = a.feed_id';
      conditions.push('a.created_at > datetime("now", "-7 days")');
    }

    if (criteria.category) {
      conditions.push('f.category = ?');
      params.push(criteria.category);
    }

    if (criteria.language) {
      conditions.push('f.language = ?');
      params.push(criteria.language);
    }

    if (criteria.isActive !== undefined) {
      conditions.push('f.is_active = ?');
      params.push(criteria.isActive ? 1 : 0);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY f.name ASC';

    return this.executeQueryAll<DatabaseRSSFeed>(
      'find_feeds_by_criteria',
      query,
      params
    );
  }

  /**
   * Batch update multiple feeds
   */
  batchUpdate(updates: Array<{ id: string; data: UpdateFeedData }>): number {
    return this.executeTransaction('batch_update_feeds', () => {
      let totalChanges = 0;
      for (const { id, data } of updates) {
        if (this.update(id, data)) {
          totalChanges++;
        }
      }
      return totalChanges;
    });
  }
}