import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { EnhancedRSSDatabaseManager } from '../database/enhanced-rss-schema.js';
import { env } from '../config/environment.js';
import type { 
  FeedSource,
  FeedInstance,
  ArticleOriginal,
  ArticleTranslation,
  FeedHealthMetric,
  TranslationJob
} from '../api/schemas/enhanced-schemas.js';

/**
 * Enhanced Database Service with bi-directional translation support
 * Provides high-level operations for feed management and translation pipeline
 */
export class EnhancedDatabaseService {
  private db: sqlite3.Database;
  private dbManager: EnhancedRSSDatabaseManager;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;
  private dbRun: (sql: string, ...params: any[]) => Promise<sqlite3.RunResult>;

  constructor(dbPath?: string) {
    const finalDbPath = dbPath || env.DATABASE_PATH;
    this.dbManager = new EnhancedRSSDatabaseManager(finalDbPath);
    this.db = (this.dbManager as any).db; // Access private db instance
    
    // Promisify database methods
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
    this.dbRun = promisify(this.db.run.bind(this.db));
  }

  async initialize(): Promise<void> {
    await this.dbManager.initialize();
  }

  // ============================================
  // FEED SOURCE MANAGEMENT
  // ============================================

  async saveFeedSource(source: Omit<FeedSource, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO feed_sources (
        id, name, base_url, provider_type, source_language, primary_region,
        content_category, content_type, is_active, quality_score, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.dbRun(sql,
      source.id, source.name, source.base_url, source.provider_type,
      source.source_language, source.primary_region, source.content_category,
      source.content_type, source.is_active, source.quality_score
    );
  }

  async getFeedSource(id: string): Promise<FeedSource | null> {
    const row = await this.dbGet('SELECT * FROM feed_sources WHERE id = ?', id);
    return row || null;
  }

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
    return await this.dbAll(sql, ...params);
  }

  async updateFeedSourceQuality(id: string, qualityScore: number): Promise<void> {
    await this.dbRun(
      'UPDATE feed_sources SET quality_score = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      qualityScore, id
    );
  }

  // ============================================
  // FEED INSTANCE MANAGEMENT
  // ============================================

  async saveFeedInstance(instance: Omit<FeedInstance, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO feed_instances (
        id, source_id, instance_name, feed_url, feed_params,
        refresh_tier, base_refresh_minutes, adaptive_refresh,
        last_fetched, last_success, consecutive_failures,
        avg_articles_per_fetch, reliability_score, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.dbRun(sql,
      instance.id, instance.source_id, instance.instance_name, instance.feed_url,
      instance.feed_params, instance.refresh_tier, instance.base_refresh_minutes,
      instance.adaptive_refresh, instance.last_fetched, instance.last_success,
      instance.consecutive_failures, instance.avg_articles_per_fetch,
      instance.reliability_score, instance.is_active
    );
  }

  async getFeedInstance(id: string): Promise<FeedInstance | null> {
    const row = await this.dbGet('SELECT * FROM feed_instances WHERE id = ?', id);
    return row || null;
  }

  async getFeedInstancesForRefresh(refreshTier: string): Promise<FeedInstance[]> {
    const sql = `
      SELECT fi.* FROM feed_instances fi
      JOIN feed_sources fs ON fi.source_id = fs.id
      WHERE fi.is_active = 1 
        AND fs.is_active = 1
        AND fi.refresh_tier = ?
        AND (fi.last_fetched IS NULL OR 
             datetime(fi.last_fetched, '+' || fi.base_refresh_minutes || ' minutes') < datetime('now'))
      ORDER BY fi.reliability_score DESC, fi.last_fetched ASC
    `;
    return await this.dbAll(sql, refreshTier);
  }

  async updateFeedInstanceHealth(
    id: string, 
    updates: {
      lastFetched?: string;
      lastSuccess?: string;
      consecutiveFailures?: number;
      avgArticlesPerFetch?: number;
      reliabilityScore?: number;
    }
  ): Promise<void> {
    const setClause: string[] = [];
    const params: any[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
        setClause.push(`${dbKey} = ?`);
        params.push(value);
      }
    });

    if (setClause.length > 0) {
      setClause.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      await this.dbRun(
        `UPDATE feed_instances SET ${setClause.join(', ')} WHERE id = ?`,
        ...params
      );
    }
  }

  // ============================================
  // ARTICLE MANAGEMENT
  // ============================================

  async saveArticleOriginal(article: Omit<ArticleOriginal, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO articles_original (
        id, feed_instance_id, title, description, content, summary, author,
        source_url, image_url, published_at, scraped_at, detected_language,
        language_confidence, content_category, content_tags, urgency_level,
        content_quality, word_count, readability_score, processing_stage,
        is_selected, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.dbRun(sql,
      article.id, article.feed_instance_id, article.title, article.description,
      article.content, article.summary, article.author, article.source_url,
      article.image_url, article.published_at, article.scraped_at,
      article.detected_language, article.language_confidence, article.content_category,
      article.content_tags, article.urgency_level, article.content_quality,
      article.word_count, article.readability_score, article.processing_stage,
      article.is_selected
    );
  }

  async getArticlesForTranslation(
    limit: number = 50,
    urgencyLevel?: string,
    language?: string
  ): Promise<ArticleOriginal[]> {
    let sql = `
      SELECT * FROM articles_original 
      WHERE processing_stage IN ('pending', 'processed') 
        AND content_quality IN ('high', 'medium')
    `;
    const params: any[] = [];

    if (urgencyLevel) {
      sql += ' AND urgency_level = ?';
      params.push(urgencyLevel);
    }

    if (language) {
      sql += ' AND detected_language = ?';
      params.push(language);
    }

    sql += ' ORDER BY urgency_level DESC, published_at DESC LIMIT ?';
    params.push(limit);

    return await this.dbAll(sql, ...params);
  }

  async updateArticleProcessingStage(id: string, stage: string): Promise<void> {
    await this.dbRun(
      'UPDATE articles_original SET processing_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      stage, id
    );
  }

  // ============================================
  // TRANSLATION MANAGEMENT
  // ============================================

  async saveArticleTranslation(translation: Omit<ArticleTranslation, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO articles_translations (
        id, original_article_id, target_language, title_translated,
        description_translated, content_translated, summary_translated,
        translation_method, translator_model, translation_quality_score,
        translation_confidence, human_reviewed, translation_started_at,
        translation_completed_at, translation_status, error_message, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.dbRun(sql,
      translation.id, translation.original_article_id, translation.target_language,
      translation.title_translated, translation.description_translated,
      translation.content_translated, translation.summary_translated,
      translation.translation_method, translation.translator_model,
      translation.translation_quality_score, translation.translation_confidence,
      translation.human_reviewed, translation.translation_started_at,
      translation.translation_completed_at, translation.translation_status,
      translation.error_message
    );
  }

  async getArticleTranslations(
    originalArticleId: string,
    targetLanguage?: string
  ): Promise<ArticleTranslation[]> {
    let sql = 'SELECT * FROM articles_translations WHERE original_article_id = ?';
    const params: any[] = [originalArticleId];

    if (targetLanguage) {
      sql += ' AND target_language = ?';
      params.push(targetLanguage);
    }

    return await this.dbAll(sql, ...params);
  }

  async getTranslatedArticlesForPublishing(
    targetLanguage: string,
    limit: number = 20
  ): Promise<Array<ArticleOriginal & { translation: ArticleTranslation }>> {
    const sql = `
      SELECT 
        ao.*,
        at.id as translation_id,
        at.title_translated,
        at.description_translated,
        at.content_translated,
        at.summary_translated,
        at.translation_quality_score,
        at.translation_completed_at
      FROM articles_original ao
      JOIN articles_translations at ON ao.id = at.original_article_id
      WHERE at.target_language = ?
        AND at.translation_status = 'completed'
        AND ao.processing_stage = 'translated'
        AND ao.is_selected = FALSE
      ORDER BY ao.urgency_level DESC, ao.published_at DESC
      LIMIT ?
    `;
    
    return await this.dbAll(sql, targetLanguage, limit);
  }

  // ============================================
  // TRANSLATION JOB QUEUE
  // ============================================

  async createTranslationJob(job: Omit<TranslationJob, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT INTO translation_jobs (
        id, original_article_id, target_languages, priority, status,
        assigned_worker, started_at, completed_at, estimated_completion,
        translation_config, max_retries, retry_count, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.dbRun(sql,
      job.id, job.original_article_id, job.target_languages, job.priority,
      job.status, job.assigned_worker, job.started_at, job.completed_at,
      job.estimated_completion, job.translation_config, job.max_retries,
      job.retry_count
    );
  }

  async getQueuedTranslationJobs(limit: number = 10): Promise<TranslationJob[]> {
    return await this.dbAll(`
      SELECT * FROM translation_jobs 
      WHERE status = 'queued' 
      ORDER BY priority DESC, created_at ASC 
      LIMIT ?
    `, limit);
  }

  async updateTranslationJobStatus(
    id: string, 
    status: string, 
    updates?: { assignedWorker?: string; errorMessage?: string }
  ): Promise<void> {
    let sql = 'UPDATE translation_jobs SET status = ?, updated_at = CURRENT_TIMESTAMP';
    const params: any[] = [status];

    if (status === 'processing') {
      sql += ', started_at = CURRENT_TIMESTAMP';
    } else if (status === 'completed') {
      sql += ', completed_at = CURRENT_TIMESTAMP';
    }

    if (updates?.assignedWorker) {
      sql += ', assigned_worker = ?';
      params.push(updates.assignedWorker);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    await this.dbRun(sql, ...params);
  }

  // ============================================
  // HEALTH MONITORING
  // ============================================

  async recordFeedHealthMetric(metric: Omit<FeedHealthMetric, 'id' | 'created_at'>): Promise<void> {
    const sql = `
      INSERT INTO feed_health_metrics (
        feed_instance_id, check_timestamp, response_time_ms, articles_found,
        articles_new, articles_duplicates, is_available, http_status,
        error_type, error_message, avg_content_length, avg_language_confidence,
        content_quality_distribution, optimal_refresh_minutes, recommended_action
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.dbRun(sql,
      metric.feed_instance_id, metric.check_timestamp, metric.response_time_ms,
      metric.articles_found, metric.articles_new, metric.articles_duplicates,
      metric.is_available, metric.http_status, metric.error_type,
      metric.error_message, metric.avg_content_length, metric.avg_language_confidence,
      metric.content_quality_distribution, metric.optimal_refresh_minutes,
      metric.recommended_action
    );
  }

  async getFeedHealthSummary(feedInstanceId: string, days: number = 7): Promise<any> {
    return await this.dbGet(`
      SELECT 
        AVG(response_time_ms) as avg_response_time,
        COUNT(CASE WHEN is_available = 1 THEN 1 END) as successful_checks,
        COUNT(*) as total_checks,
        SUM(articles_new) as total_new_articles,
        AVG(avg_language_confidence) as avg_language_confidence
      FROM feed_health_metrics
      WHERE feed_instance_id = ?
        AND check_timestamp > datetime('now', '-' || ? || ' days')
    `, feedInstanceId, days);
  }

  // ============================================
  // ANALYTICS & REPORTING
  // ============================================

  async getFeedPerformanceSummary(): Promise<any[]> {
    return await this.dbAll('SELECT * FROM feed_performance_summary');
  }

  async getTranslationPipelineStatus(): Promise<any[]> {
    return await this.dbAll('SELECT * FROM translation_pipeline_status');
  }

  async getDailyPerformanceOverview(days: number = 30): Promise<any[]> {
    return await this.dbAll('SELECT * FROM daily_performance_overview LIMIT ?', days);
  }

  async getTranslationQualityMetrics(days: number = 7): Promise<any> {
    return await this.dbGet(`
      SELECT 
        AVG(translation_quality_score) as avg_quality,
        COUNT(CASE WHEN translation_quality_score >= 0.8 THEN 1 END) as high_quality_count,
        COUNT(*) as total_translations,
        AVG(translation_confidence) as avg_confidence
      FROM articles_translations
      WHERE translation_status = 'completed'
        AND created_at > datetime('now', '-' || ? || ' days')
    `, days);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  async close(): Promise<void> {
    await this.dbManager.close();
  }

  async runMaintenance(): Promise<{
    articlesCleanedUp: number;
    healthMetricsCleanedUp: number;
    failedJobsRetried: number;
  }> {
    // Clean up old articles (30 days)
    const articlesResult = await this.dbRun(`
      DELETE FROM articles_original 
      WHERE created_at < datetime('now', '-30 days')
        AND is_selected = 0
    `);

    // Clean up old health metrics (7 days)
    const healthResult = await this.dbRun(`
      DELETE FROM feed_health_metrics 
      WHERE created_at < datetime('now', '-7 days')
    `);

    // Retry failed translation jobs (max 3 retries)
    const failedJobsResult = await this.dbRun(`
      UPDATE translation_jobs 
      SET status = 'queued', retry_count = retry_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE status = 'failed' 
        AND retry_count < max_retries
        AND created_at > datetime('now', '-1 day')
    `);

    return {
      articlesCleanedUp: articlesResult.changes || 0,
      healthMetricsCleanedUp: healthResult.changes || 0,
      failedJobsRetried: failedJobsResult.changes || 0
    };
  }
}