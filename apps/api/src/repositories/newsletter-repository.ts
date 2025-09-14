import { v4 as uuidv4 } from 'uuid';
import { getDatabase, type PostgreSQLConnection } from '../database/connection.js';
import type { NewsletterIssueType, CreateNewsletterInputType, UpdateNewsletterInputType } from '@mtrx/contracts';

export interface DatabaseFilterOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'issue_number' | 'publish_date' | 'created_at';
  sortOrder?: 'ASC' | 'DESC';
  status?: 'draft' | 'published' | 'archived';
  language?: string;
}

export class NewsletterRepository {
  private db: PostgreSQLConnection;

  constructor() {
    this.db = getDatabase();
  }

  async findMany(options: DatabaseFilterOptions = {}): Promise<NewsletterIssueType[]> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'issue_number',
      sortOrder = 'DESC',
      status,
      language
    } = options;

    let query = 'SELECT * FROM newsletters WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (language) {
      query += ` AND language = $${params.length + 1}`;
      params.push(language);
    }

    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await this.db.all(query, ...params);
    return rows.map(this.mapRowToNewsletter);
  }

  async count(options: DatabaseFilterOptions = {}): Promise<number> {
    const { status, language } = options;

    let query = 'SELECT COUNT(*) as total FROM newsletters WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }

    if (language) {
      query += ` AND language = $${params.length + 1}`;
      params.push(language);
    }

    const result = await this.db.get(query, ...params) as { total: number };
    return result.total;
  }

  async findById(id: string): Promise<NewsletterIssueType | null> {
    const row = await this.db.get('SELECT * FROM newsletters WHERE id = $1', id);

    if (!row) return null;
    return this.mapRowToNewsletter(row);
  }

  async findByIssueNumber(issueNumber: number): Promise<NewsletterIssueType | null> {
    const row = await this.db.get('SELECT * FROM newsletters WHERE issue_number = $1', issueNumber);

    if (!row) return null;
    return this.mapRowToNewsletter(row);
  }

  async getNextIssueNumber(): Promise<number> {
    const result = await this.db.get('SELECT MAX(issue_number) as max_issue FROM newsletters') as { max_issue: number | null };
    return (result.max_issue || 0) + 1;
  }

  async create(data: CreateNewsletterInputType): Promise<NewsletterIssueType> {
    const id = uuidv4();
    const issueNumber = await this.getNextIssueNumber();
    const now = new Date().toISOString();

    await this.db.run(`
      INSERT INTO newsletters (id, issue_number, title, subtitle, publish_date, language, content_metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
      id,
      issueNumber,
      data.title,
      data.subtitle || null,
      data.publish_date,
      data.language,
      data.content_metadata ? JSON.stringify(data.content_metadata) : null,
      now,
      now
    );

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create newsletter');
    }

    return created;
  }

  async update(id: string, data: UpdateNewsletterInputType): Promise<NewsletterIssueType> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Newsletter not found');
    }

    const updateFields: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      updateFields.push(`title = $${params.length + 1}`);
      params.push(data.title);
    }

    if (data.subtitle !== undefined) {
      updateFields.push(`subtitle = $${params.length + 1}`);
      params.push(data.subtitle);
    }

    if (data.publish_date !== undefined) {
      updateFields.push(`publish_date = $${params.length + 1}`);
      params.push(data.publish_date);
    }

    if (data.status !== undefined) {
      updateFields.push(`status = $${params.length + 1}`);
      params.push(data.status);

      // Set published_at when status changes to published
      if (data.status === 'published' && existing.status !== 'published') {
        updateFields.push(`published_at = $${params.length + 1}`);
        params.push(new Date().toISOString());
      }
    }

    if (data.language !== undefined) {
      updateFields.push(`language = $${params.length + 1}`);
      params.push(data.language);
    }

    if (data.content_metadata !== undefined) {
      updateFields.push(`content_metadata = $${params.length + 1}`);
      params.push(data.content_metadata ? JSON.stringify(data.content_metadata) : null);
    }

    updateFields.push(`updated_at = $${params.length + 1}`);
    params.push(new Date().toISOString());

    const whereClause = `id = $${params.length + 1}`;
    params.push(id);

    await this.db.run(`
      UPDATE newsletters SET ${updateFields.join(', ')} WHERE ${whereClause}
    `, ...params);

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to update newsletter');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.run('DELETE FROM newsletters WHERE id = $1', id);

    if (result.changes === 0) {
      throw new Error('Newsletter not found');
    }
  }

  private mapRowToNewsletter(row: any): NewsletterIssueType {
    return {
      id: row.id,
      issue_number: row.issue_number,
      title: row.title,
      subtitle: row.subtitle || undefined,
      publish_date: row.publish_date,
      status: row.status,
      language: row.language,
      content_metadata: row.content_metadata ? JSON.parse(row.content_metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at || undefined
    };
  }
}

export const newsletterRepository = new NewsletterRepository();