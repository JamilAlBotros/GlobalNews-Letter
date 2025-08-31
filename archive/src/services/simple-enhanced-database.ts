import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import type { 
  FeedSource,
  FeedInstance,
  ArticleOriginal,
  ArticleTranslation,
  FeedHealthMetric,
  TranslationJob
} from '../api/schemas/enhanced-schemas.js';

/**
 * Simple Enhanced Database Service
 * Direct SQLite connection without complex initialization
 */
export class SimpleEnhancedDatabaseService {
  private db: sqlite3.Database;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;
  private dbRun: (sql: string, ...params: any[]) => Promise<sqlite3.RunResult>;

  constructor(dbPath: string) {
    console.log('🔗 Connecting to database:', dbPath);
    this.db = new sqlite3.Database(dbPath);
    
    // Promisify database methods
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
    this.dbRun = promisify(this.db.run.bind(this.db));
    
    console.log('✅ Database connection established');
  }

  async initialize(): Promise<void> {
    console.log('🔄 Database initialization (no-op for simple service)');
    // No complex initialization needed since tables already exist
  }

  // ============================================
  // FEED SOURCE MANAGEMENT
  // ============================================

  async getFeedSources(filters?: {
    language?: string;
    category?: string;
    activeOnly?: boolean;
  }): Promise<FeedSource[]> {
    let sql = 'SELECT * FROM feed_sources WHERE 1=1';
    const params: any[] = [];

    if (filters?.language) {
      sql += ' AND source_language = ?';
      params.push(filters.language);
    }

    if (filters?.category) {
      sql += ' AND content_category = ?';
      params.push(filters.category);
    }

    if (filters?.activeOnly) {
      sql += ' AND is_active = 1';
    }

    sql += ' ORDER BY quality_score DESC, name';
    console.log('📊 Executing query:', sql, 'with params:', params);
    
    const results = await this.dbAll(sql, ...params);
    console.log('📊 Query returned:', results.length, 'results');
    
    return results;
  }

  async getFeedSource(id: string): Promise<FeedSource | null> {
    const row = await this.dbGet('SELECT * FROM feed_sources WHERE id = ?', id);
    return row || null;
  }

  async saveFeedSource(source: Omit<FeedSource, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO feed_sources (
        id, name, base_url, provider_type, source_language, primary_region,
        content_category, content_type, is_active, quality_score, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.dbRun(sql, [
      source.id, source.name, source.base_url, source.provider_type,
      source.source_language, source.primary_region, source.content_category,
      source.content_type, source.is_active, source.quality_score
    ]);
  }

  // Additional placeholder methods for other operations
  async getFeedInstances(): Promise<FeedInstance[]> {
    return await this.dbAll('SELECT * FROM feed_instances ORDER BY instance_name');
  }

  async saveFeedInstance(instance: Omit<FeedInstance, 'created_at' | 'updated_at'>): Promise<void> {
    // Implementation would go here
    throw new Error('Not implemented yet');
  }

  async getFeedInstancesForRefresh(tier: string): Promise<FeedInstance[]> {
    return await this.dbAll('SELECT * FROM feed_instances WHERE refresh_tier = ? AND is_active = 1', tier);
  }

  async getArticlesForTranslation(limit: number, urgency?: string, language?: string): Promise<ArticleOriginal[]> {
    let sql = 'SELECT * FROM articles_original WHERE processing_stage = ?';
    const params: any[] = ['pending'];
    
    if (urgency) {
      sql += ' AND urgency_level = ?';
      params.push(urgency);
    }
    
    if (language) {
      sql += ' AND detected_language = ?';
      params.push(language);
    }
    
    sql += ' ORDER BY published_at DESC LIMIT ?';
    params.push(limit);
    
    return await this.dbAll(sql, ...params);
  }

  async updateArticleProcessingStage(articleId: string, stage: string): Promise<void> {
    await this.dbRun(
      'UPDATE articles_original SET processing_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      stage, articleId
    );
  }

  async getTranslatedArticlesForPublishing(language: string, limit: number): Promise<any[]> {
    const sql = `
      SELECT a.*, t.* 
      FROM articles_original a 
      JOIN articles_translations t ON a.id = t.original_article_id 
      WHERE t.target_language = ? AND t.translation_status = 'completed'
      ORDER BY a.published_at DESC 
      LIMIT ?
    `;
    
    return await this.dbAll(sql, language, limit);
  }

  async getFeedPerformanceSummary(): Promise<any[]> {
    const sql = `
      SELECT 
        fi.id,
        fs.name as source_name,
        fi.instance_name,
        fs.source_language,
        fs.content_category,
        fi.refresh_tier,
        fi.reliability_score,
        0 as total_articles_24h,
        0 as high_quality_articles
      FROM feed_instances fi
      JOIN feed_sources fs ON fi.source_id = fs.id
      WHERE fi.is_active = 1
      ORDER BY fi.reliability_score DESC
    `;
    
    return await this.dbAll(sql);
  }

  async runMaintenance(): Promise<any> {
    // Basic maintenance operations
    return {
      cleaned_old_metrics: 0,
      optimized_tables: true
    };
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => {
        console.log('🔒 Database connection closed');
        resolve();
      });
    });
  }
}