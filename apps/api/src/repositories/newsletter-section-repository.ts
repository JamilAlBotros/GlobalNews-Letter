import { Database } from 'sqlite';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database/connection.js';
import type { NewsletterSectionType, CreateNewsletterSectionInputType } from '@mtrx/contracts/src/schemas/newsletter.js';

export interface SectionFilterOptions {
  limit?: number;
  offset?: number;
  section_type?: 'header' | 'top_news' | 'market_trends' | 'footer' | 'custom';
  is_recurring?: boolean;
  sortBy?: 'display_order' | 'name' | 'created_at';
  sortOrder?: 'ASC' | 'DESC';
}

export class NewsletterSectionRepository {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  async findMany(options: SectionFilterOptions = {}): Promise<NewsletterSectionType[]> {
    const {
      limit = 50,
      offset = 0,
      section_type,
      is_recurring,
      sortBy = 'display_order',
      sortOrder = 'ASC'
    } = options;

    let query = 'SELECT * FROM newsletter_sections WHERE 1=1';
    const params: any[] = [];

    if (section_type) {
      query += ' AND section_type = ?';
      params.push(section_type);
    }

    if (is_recurring !== undefined) {
      query += ' AND is_recurring = ?';
      params.push(is_recurring);
    }

    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(this.mapRowToSection);
  }

  async findById(id: string): Promise<NewsletterSectionType | null> {
    const stmt = this.db.prepare('SELECT * FROM newsletter_sections WHERE id = ?');
    const row = stmt.get(id);

    if (!row) return null;
    return this.mapRowToSection(row);
  }

  async findByType(sectionType: string): Promise<NewsletterSectionType[]> {
    const stmt = this.db.prepare('SELECT * FROM newsletter_sections WHERE section_type = ? ORDER BY display_order ASC');
    const rows = stmt.all(sectionType);

    return rows.map(this.mapRowToSection);
  }

  async findRecurringSections(): Promise<NewsletterSectionType[]> {
    const stmt = this.db.prepare('SELECT * FROM newsletter_sections WHERE is_recurring = TRUE ORDER BY display_order ASC');
    const rows = stmt.all();

    return rows.map(this.mapRowToSection);
  }

  async create(data: CreateNewsletterSectionInputType): Promise<NewsletterSectionType> {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO newsletter_sections (
        id, name, display_name, section_type, template_content, is_recurring, display_order, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      data.name,
      data.display_name,
      data.section_type,
      data.template_content,
      data.is_recurring || false,
      data.display_order || 0,
      data.metadata ? JSON.stringify(data.metadata) : null,
      now,
      now
    );

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to create newsletter section');
    }

    return created;
  }

  async update(id: string, data: Partial<CreateNewsletterSectionInputType>): Promise<NewsletterSectionType> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error('Newsletter section not found');
    }

    const updateFields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      updateFields.push('name = ?');
      params.push(data.name);
    }

    if (data.display_name !== undefined) {
      updateFields.push('display_name = ?');
      params.push(data.display_name);
    }

    if (data.section_type !== undefined) {
      updateFields.push('section_type = ?');
      params.push(data.section_type);
    }

    if (data.template_content !== undefined) {
      updateFields.push('template_content = ?');
      params.push(data.template_content);
    }

    if (data.is_recurring !== undefined) {
      updateFields.push('is_recurring = ?');
      params.push(data.is_recurring);
    }

    if (data.display_order !== undefined) {
      updateFields.push('display_order = ?');
      params.push(data.display_order);
    }

    if (data.metadata !== undefined) {
      updateFields.push('metadata = ?');
      params.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    updateFields.push('updated_at = ?');
    params.push(new Date().toISOString());

    params.push(id);

    const stmt = this.db.prepare(`
      UPDATE newsletter_sections SET ${updateFields.join(', ')} WHERE id = ?
    `);

    stmt.run(...params);

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to update newsletter section');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM newsletter_sections WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes === 0) {
      throw new Error('Newsletter section not found');
    }
  }

  async count(options: SectionFilterOptions = {}): Promise<number> {
    const { section_type, is_recurring } = options;

    let query = 'SELECT COUNT(*) as total FROM newsletter_sections WHERE 1=1';
    const params: any[] = [];

    if (section_type) {
      query += ' AND section_type = ?';
      params.push(section_type);
    }

    if (is_recurring !== undefined) {
      query += ' AND is_recurring = ?';
      params.push(is_recurring);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { total: number };
    return result.total;
  }

  async getMaxDisplayOrder(sectionType?: string): Promise<number> {
    let query = 'SELECT MAX(display_order) as max_order FROM newsletter_sections';
    const params: any[] = [];

    if (sectionType) {
      query += ' WHERE section_type = ?';
      params.push(sectionType);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { max_order: number | null };
    return result.max_order || 0;
  }

  async reorderSections(sectionUpdates: Array<{ id: string; display_order: number }>): Promise<void> {
    const transaction = this.db.transaction(() => {
      for (const update of sectionUpdates) {
        const stmt = this.db.prepare('UPDATE newsletter_sections SET display_order = ?, updated_at = ? WHERE id = ?');
        stmt.run(update.display_order, new Date().toISOString(), update.id);
      }
    });

    transaction();
  }

  private mapRowToSection(row: any): NewsletterSectionType {
    return {
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      section_type: row.section_type,
      template_content: row.template_content,
      is_recurring: Boolean(row.is_recurring),
      display_order: row.display_order,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const newsletterSectionRepository = new NewsletterSectionRepository();