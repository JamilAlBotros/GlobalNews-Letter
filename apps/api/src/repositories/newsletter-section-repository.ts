import { v4 as uuidv4 } from 'uuid';
import { getDatabase, type PostgreSQLConnection } from '../database/connection.js';
import type { NewsletterSectionType, CreateNewsletterSectionInputType } from '@mtrx/contracts';

export interface SectionFilterOptions {
  limit?: number;
  offset?: number;
  section_type?: 'header' | 'top_news' | 'market_trends' | 'footer' | 'custom';
  is_recurring?: boolean;
  sortBy?: 'display_order' | 'name' | 'created_at';
  sortOrder?: 'ASC' | 'DESC';
}

export class NewsletterSectionRepository {
  private db: PostgreSQLConnection;

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
      query += ` AND section_type = $${params.length + 1}`;
      params.push(section_type);
    }

    if (is_recurring !== undefined) {
      query += ` AND is_recurring = $${params.length + 1}`;
      params.push(is_recurring);
    }

    query += ` ORDER BY ${sortBy} ${sortOrder} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await this.db.all(query, ...params);
    return rows.map(this.mapRowToSection);
  }

  async findById(id: string): Promise<NewsletterSectionType | null> {
    const row = await this.db.get('SELECT * FROM newsletter_sections WHERE id = $1', id);

    if (!row) return null;
    return this.mapRowToSection(row);
  }

  async findByType(sectionType: string): Promise<NewsletterSectionType[]> {
    const rows = await this.db.all('SELECT * FROM newsletter_sections WHERE section_type = $1 ORDER BY display_order ASC', sectionType);
    return rows.map(this.mapRowToSection);
  }

  async findRecurringSections(): Promise<NewsletterSectionType[]> {
    const rows = await this.db.all('SELECT * FROM newsletter_sections WHERE is_recurring = TRUE ORDER BY display_order ASC');
    return rows.map(this.mapRowToSection);
  }

  async create(data: CreateNewsletterSectionInputType): Promise<NewsletterSectionType> {
    const id = uuidv4();
    const now = new Date().toISOString();

    await this.db.run(`
      INSERT INTO newsletter_sections (
        id, name, display_name, section_type, template_content, is_recurring, display_order, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `,
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
      updateFields.push(`name = $${params.length + 1}`);
      params.push(data.name);
    }

    if (data.display_name !== undefined) {
      updateFields.push(`display_name = $${params.length + 1}`);
      params.push(data.display_name);
    }

    if (data.section_type !== undefined) {
      updateFields.push(`section_type = $${params.length + 1}`);
      params.push(data.section_type);
    }

    if (data.template_content !== undefined) {
      updateFields.push(`template_content = $${params.length + 1}`);
      params.push(data.template_content);
    }

    if (data.is_recurring !== undefined) {
      updateFields.push(`is_recurring = $${params.length + 1}`);
      params.push(data.is_recurring);
    }

    if (data.display_order !== undefined) {
      updateFields.push(`display_order = $${params.length + 1}`);
      params.push(data.display_order);
    }

    if (data.metadata !== undefined) {
      updateFields.push(`metadata = $${params.length + 1}`);
      params.push(data.metadata ? JSON.stringify(data.metadata) : null);
    }

    updateFields.push(`updated_at = $${params.length + 1}`);
    params.push(new Date().toISOString());

    const whereClause = `id = $${params.length + 1}`;
    params.push(id);

    await this.db.run(`
      UPDATE newsletter_sections SET ${updateFields.join(', ')} WHERE ${whereClause}
    `, ...params);

    const updated = await this.findById(id);
    if (!updated) {
      throw new Error('Failed to update newsletter section');
    }

    return updated;
  }

  async delete(id: string): Promise<void> {
    const result = await this.db.run('DELETE FROM newsletter_sections WHERE id = $1', id);

    if (result.changes === 0) {
      throw new Error('Newsletter section not found');
    }
  }

  async count(options: SectionFilterOptions = {}): Promise<number> {
    const { section_type, is_recurring } = options;

    let query = 'SELECT COUNT(*) as total FROM newsletter_sections WHERE 1=1';
    const params: any[] = [];

    if (section_type) {
      query += ` AND section_type = $${params.length + 1}`;
      params.push(section_type);
    }

    if (is_recurring !== undefined) {
      query += ` AND is_recurring = $${params.length + 1}`;
      params.push(is_recurring);
    }

    const result = await this.db.get(query, ...params) as { total: number };
    return result.total;
  }

  async getMaxDisplayOrder(sectionType?: string): Promise<number> {
    let query = 'SELECT MAX(display_order) as max_order FROM newsletter_sections';
    const params: any[] = [];

    if (sectionType) {
      query += ' WHERE section_type = $1';
      params.push(sectionType);
    }

    const result = await this.db.get(query, ...params) as { max_order: number | null };
    return result.max_order || 0;
  }

  async reorderSections(sectionUpdates: Array<{ id: string; display_order: number }>): Promise<void> {
    await this.db.transaction(async (client) => {
      for (const update of sectionUpdates) {
        await client.query('UPDATE newsletter_sections SET display_order = $1, updated_at = $2 WHERE id = $3', [
          update.display_order,
          new Date().toISOString(),
          update.id
        ]);
      }
    });
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