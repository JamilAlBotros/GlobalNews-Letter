import { getDatabase } from '../database/connection.js';
import { v4 as uuidv4 } from 'uuid';

export interface TranslatedArticle {
  id: string;
  title: Record<string, string>; // { "es": "Título traducido", "fr": "Titre traduit" }
  summary: Record<string, string>; // { "es": "Resumen traducido", "fr": "Résumé traduit" }
}

export interface NewsletterTranslationJob {
  id: string;
  title: string;
  content: string;
  source_language: string;
  target_languages: string[];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  original_articles: any[];
  translated_content: Record<string, string> | null;
  translated_articles: Record<string, TranslatedArticle[]> | null; // { "es": [...], "fr": [...] }
  progress: number;
  assigned_worker: string | null;
  retry_count: number;
  max_retries: number;
  error_message: string | null;
  estimated_completion: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNewsletterTranslationJobInput {
  title: string;
  content: string;
  source_language?: string;
  target_languages: string[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  original_articles: any[];
}

export interface UpdateNewsletterTranslationJobInput {
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  assigned_worker?: string;
  translated_content?: Record<string, string>;
  translated_articles?: Record<string, TranslatedArticle[]>;
  error_message?: string;
  estimated_completion?: string;
}

export class NewsletterTranslationJobRepository {
  private db = getDatabase();

  async findAll(limit: number = 50, offset: number = 0): Promise<NewsletterTranslationJob[]> {
    const rows = await this.db.all(
      `SELECT * FROM newsletter_translation_jobs 
       ORDER BY created_at DESC 
       LIMIT $1 OFFSET $2`,
      limit, offset
    );
    
    return rows.map(this.mapRow);
  }

  async findById(id: string): Promise<NewsletterTranslationJob | null> {
    const row = await this.db.get(
      `SELECT * FROM newsletter_translation_jobs WHERE id = $1`,
      id
    );
    
    return row ? this.mapRow(row) : null;
  }

  async findByStatus(status: string, limit: number = 50): Promise<NewsletterTranslationJob[]> {
    const rows = await this.db.all(
      `SELECT * FROM newsletter_translation_jobs 
       WHERE status = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      status, limit
    );
    
    return rows.map(this.mapRow);
  }

  async findPendingJobs(limit: number = 10): Promise<NewsletterTranslationJob[]> {
    const rows = await this.db.all(
      `SELECT * FROM newsletter_translation_jobs 
       WHERE status = 'pending' 
       ORDER BY priority DESC, created_at ASC 
       LIMIT $1`,
      limit
    );
    
    return rows.map(this.mapRow);
  }

  async create(input: CreateNewsletterTranslationJobInput): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    await this.db.run(
      `INSERT INTO newsletter_translation_jobs (
        id, title, content, source_language, target_languages, 
        priority, original_articles, status, progress, retry_count, 
        max_retries, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 0, 0, 3, $8, $9)`,
      id,
      input.title,
      input.content,
      input.source_language || 'en',
      JSON.stringify(input.target_languages),
      input.priority || 'normal',
      JSON.stringify(input.original_articles),
      now,
      now
    );
    
    return id;
  }

  async update(id: string, input: UpdateNewsletterTranslationJobInput): Promise<boolean> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(input.status);
      
      if (input.status === 'processing' && !input.assigned_worker) {
        updates.push(`started_at = $${paramIndex++}`);
        values.push(new Date().toISOString());
      }
      
      if (input.status === 'completed' || input.status === 'failed') {
        updates.push(`completed_at = $${paramIndex++}`);
        values.push(new Date().toISOString());
      }
    }
    
    if (input.progress !== undefined) {
      updates.push(`progress = $${paramIndex++}`);
      values.push(input.progress);
    }
    
    if (input.assigned_worker !== undefined) {
      updates.push(`assigned_worker = $${paramIndex++}`);
      values.push(input.assigned_worker);
    }
    
    if (input.translated_content !== undefined) {
      updates.push(`translated_content = $${paramIndex++}`);
      values.push(JSON.stringify(input.translated_content));
    }
    
    if (input.translated_articles !== undefined) {
      updates.push(`translated_articles = $${paramIndex++}`);
      values.push(JSON.stringify(input.translated_articles));
    }
    
    if (input.error_message !== undefined) {
      updates.push(`error_message = $${paramIndex++}`);
      values.push(input.error_message);
    }
    
    if (input.estimated_completion !== undefined) {
      updates.push(`estimated_completion = $${paramIndex++}`);
      values.push(input.estimated_completion);
    }
    
    if (updates.length === 0) return false;
    
    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date().toISOString());
    values.push(id);
    
    const result = await this.db.run(`
      UPDATE newsletter_translation_jobs 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
    `, ...values);
    
    return result.changes > 0;
  }

  async incrementRetry(id: string): Promise<boolean> {
    const result = await this.db.run(`
      UPDATE newsletter_translation_jobs 
      SET retry_count = retry_count + 1, updated_at = $1
      WHERE id = $2
    `, new Date().toISOString(), id);
    
    return result.changes > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM newsletter_translation_jobs WHERE id = $1', id);
    return result.changes > 0;
  }

  async getStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const result = await this.db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM newsletter_translation_jobs
    `) as any;
    
    return {
      total: result.total || 0,
      pending: result.pending || 0,
      processing: result.processing || 0,
      completed: result.completed || 0,
      failed: result.failed || 0
    };
  }

  private mapRow(row: any): NewsletterTranslationJob {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      source_language: row.source_language,
      target_languages: JSON.parse(row.target_languages || '[]'),
      status: row.status,
      priority: row.priority,
      original_articles: JSON.parse(row.original_articles || '[]'),
      translated_content: row.translated_content ? JSON.parse(row.translated_content) : null,
      translated_articles: row.translated_articles ? JSON.parse(row.translated_articles) : null,
      progress: row.progress || 0,
      assigned_worker: row.assigned_worker,
      retry_count: row.retry_count || 0,
      max_retries: row.max_retries || 3,
      error_message: row.error_message,
      estimated_completion: row.estimated_completion,
      started_at: row.started_at,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at
    };
  }
}

export const newsletterTranslationJobRepository = new NewsletterTranslationJobRepository();