import { getDatabase } from '../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface GoogleRSSFeed {
  id: string;
  name: string;
  url: string;
  mode: 'topic' | 'search';
  topic?: string;
  search_query?: string;
  time_frame?: string;
  country: string;
  language: string;
  is_active: boolean;
  is_validated: boolean;
  last_scraped?: string;
  article_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateGoogleRSSFeedInput {
  name: string;
  url: string;
  mode: 'topic' | 'search';
  topic?: string;
  search_query?: string;
  time_frame?: string;
  country: string;
  language: string;
}

export interface UpdateGoogleRSSFeedInput {
  name?: string;
  is_active?: boolean;
  is_validated?: boolean;
  last_scraped?: string;
  article_count?: number;
}

export class GoogleRSSFeedRepository {
  private db = getDatabase();

  async findAll(limit: number = 50, offset: number = 0): Promise<GoogleRSSFeed[]> {
    const rows = await this.db.all(
      `SELECT * FROM google_rss_feeds 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      limit, offset
    );
    
    return rows.map(this.mapRow);
  }

  async findById(id: string): Promise<GoogleRSSFeed | null> {
    const row = await this.db.get(
      `SELECT * FROM google_rss_feeds WHERE id = $1`,
      id
    );
    
    return row ? this.mapRow(row) : null;
  }

  async findByMode(mode: 'topic' | 'search', limit: number = 50): Promise<GoogleRSSFeed[]> {
    const rows = await this.db.all(
      `SELECT * FROM google_rss_feeds 
       WHERE mode = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      mode, limit
    );
    
    return rows.map(this.mapRow);
  }

  async findActive(limit: number = 50): Promise<GoogleRSSFeed[]> {
    const rows = await this.db.all(
      `SELECT * FROM google_rss_feeds 
       WHERE is_active = TRUE 
       ORDER BY created_at DESC 
       LIMIT $1`,
      limit
    );
    
    return rows.map(this.mapRow);
  }

  async create(input: CreateGoogleRSSFeedInput): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await this.db.run(
      `INSERT INTO google_rss_feeds (
        id, name, url, mode, topic, search_query, time_frame, 
        country, language, is_active, is_validated, article_count, 
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, FALSE, 0, $10, $11)`,
      id,
      input.name,
      input.url,
      input.mode,
      input.topic || null,
      input.search_query || null,
      input.time_frame || null,
      input.country,
      input.language,
      now,
      now
    );
    
    return id;
  }

  async update(id: string, input: UpdateGoogleRSSFeedInput): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(input.name);
    }
    
    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(input.is_active);
    }
    
    if (input.is_validated !== undefined) {
      updates.push(`is_validated = $${paramIndex++}`);
      values.push(input.is_validated);
    }
    
    if (input.last_scraped !== undefined) {
      updates.push(`last_scraped = $${paramIndex++}`);
      values.push(input.last_scraped);
    }
    
    if (input.article_count !== undefined) {
      updates.push(`article_count = $${paramIndex++}`);
      values.push(input.article_count);
    }
    
    if (updates.length === 0) return false;
    
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);
    
    const result = await this.db.run(`
      UPDATE google_rss_feeds 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
    `, ...values);
    
    return result.changes > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM google_rss_feeds WHERE id = $1', id);
    return result.changes > 0;
  }

  async validateFeed(id: string): Promise<boolean> {
    const result = await this.db.run(`
      UPDATE google_rss_feeds 
      SET is_validated = TRUE, updated_at = $1
      WHERE id = $2
    `, new Date().toISOString(), id);
    
    return result.changes > 0;
  }

  async getStats(): Promise<{
    total: number;
    active: number;
    validated: number;
    topic_feeds: number;
    search_feeds: number;
  }> {
    const result = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_validated = TRUE THEN 1 ELSE 0 END) as validated,
        SUM(CASE WHEN mode = 'topic' THEN 1 ELSE 0 END) as topic_feeds,
        SUM(CASE WHEN mode = 'search' THEN 1 ELSE 0 END) as search_feeds
      FROM google_rss_feeds
    `) as any;
    
    return {
      total: result.total || 0,
      active: result.active || 0,
      validated: result.validated || 0,
      topic_feeds: result.topic_feeds || 0,
      search_feeds: result.search_feeds || 0
    };
  }

  private mapRow(row: any): GoogleRSSFeed {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      mode: row.mode,
      topic: row.topic,
      search_query: row.search_query,
      time_frame: row.time_frame,
      country: row.country,
      language: row.language,
      is_active: Boolean(row.is_active),
      is_validated: Boolean(row.is_validated),
      last_scraped: row.last_scraped,
      article_count: row.article_count || 0,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const googleRSSFeedRepository = new GoogleRSSFeedRepository();