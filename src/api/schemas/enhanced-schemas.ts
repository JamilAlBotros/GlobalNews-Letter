import { z } from 'zod';

/**
 * Enhanced Zod Schemas for RSS Feed and Translation System
 * Contract-first API design following CLAUDE.md guidelines
 */

// ============================================
// BASE ENUMS AND TYPES
// ============================================

export const LanguageCodeSchema = z.enum(['en', 'es', 'ar', 'pt', 'fr', 'zh', 'ja']);
export const ProviderTypeSchema = z.enum(['rss', 'google_rss', 'api', 'scraper']);
export const ContentCategorySchema = z.enum(['finance', 'tech', 'health', 'general']);
export const ContentTypeSchema = z.enum(['breaking', 'analysis', 'daily', 'weekly']);
export const RefreshTierSchema = z.enum(['realtime', 'frequent', 'standard', 'slow']);
export const UrgencyLevelSchema = z.enum(['breaking', 'high', 'normal', 'low']);
export const ContentQualitySchema = z.enum(['high', 'medium', 'low', 'failed']);
export const ProcessingStageSchema = z.enum(['pending', 'processed', 'translated', 'published', 'failed']);
export const TranslationMethodSchema = z.enum(['ai', 'human', 'hybrid']);
export const TranslationStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed', 'review_needed']);
export const JobStatusSchema = z.enum(['queued', 'processing', 'completed', 'failed', 'cancelled']);
export const JobPrioritySchema = z.enum(['urgent', 'high', 'normal', 'low']);
export const RecommendedActionSchema = z.enum(['increase_frequency', 'decrease_frequency', 'maintain', 'disable']);

// ============================================
// FEED SOURCE SCHEMAS
// ============================================

export const FeedSourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  base_url: z.string().url(),
  provider_type: ProviderTypeSchema,
  source_language: LanguageCodeSchema,
  primary_region: z.string().length(2).optional(),
  content_category: ContentCategorySchema,
  content_type: ContentTypeSchema,
  is_active: z.boolean(),
  quality_score: z.number().min(0).max(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateFeedSourceSchema = z.object({
  name: z.string().min(1).max(255),
  base_url: z.string().url(),
  provider_type: ProviderTypeSchema,
  source_language: LanguageCodeSchema,
  primary_region: z.string().length(2).optional(),
  content_category: ContentCategorySchema,
  content_type: ContentTypeSchema
});

export const UpdateFeedSourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  base_url: z.string().url().optional(),
  provider_type: ProviderTypeSchema.optional(),
  source_language: LanguageCodeSchema.optional(),
  primary_region: z.string().length(2).optional(),
  content_category: ContentCategorySchema.optional(),
  content_type: ContentTypeSchema.optional(),
  is_active: z.boolean().optional(),
  quality_score: z.number().min(0).max(1).optional()
});

// ============================================
// FEED INSTANCE SCHEMAS
// ============================================

export const FeedInstanceSchema = z.object({
  id: z.string().uuid(),
  source_id: z.string().uuid(),
  instance_name: z.string().min(1).max(255),
  feed_url: z.string().url(),
  feed_params: z.string().optional(), // JSON string
  refresh_tier: RefreshTierSchema,
  base_refresh_minutes: z.number().int().min(1).max(1440),
  adaptive_refresh: z.boolean(),
  last_fetched: z.string().datetime().nullable(),
  last_success: z.string().datetime().nullable(),
  consecutive_failures: z.number().int().min(0),
  avg_articles_per_fetch: z.number().min(0),
  reliability_score: z.number().min(0).max(1),
  is_active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateFeedInstanceSchema = z.object({
  source_id: z.string().uuid(),
  instance_name: z.string().min(1).max(255),
  feed_url: z.string().url(),
  feed_params: z.string().optional(),
  refresh_tier: RefreshTierSchema.default('standard'),
  base_refresh_minutes: z.number().int().min(1).max(1440).default(60),
  adaptive_refresh: z.boolean().default(true)
});

export const UpdateFeedInstanceSchema = z.object({
  instance_name: z.string().min(1).max(255).optional(),
  feed_url: z.string().url().optional(),
  feed_params: z.string().optional(),
  refresh_tier: RefreshTierSchema.optional(),
  base_refresh_minutes: z.number().int().min(1).max(1440).optional(),
  adaptive_refresh: z.boolean().optional(),
  is_active: z.boolean().optional()
});

// ============================================
// ARTICLE SCHEMAS
// ============================================

export const ArticleOriginalSchema = z.object({
  id: z.string().uuid(),
  feed_instance_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  author: z.string().optional(),
  source_url: z.string().url(),
  image_url: z.string().url().optional(),
  published_at: z.string().datetime(),
  scraped_at: z.string().datetime(),
  detected_language: LanguageCodeSchema,
  language_confidence: z.number().min(0).max(1),
  content_category: ContentCategorySchema.optional(),
  content_tags: z.string().optional(), // JSON array
  urgency_level: UrgencyLevelSchema,
  content_quality: ContentQualitySchema,
  word_count: z.number().int().min(0).optional(),
  readability_score: z.number().min(0).max(1).optional(),
  processing_stage: ProcessingStageSchema,
  is_selected: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateArticleOriginalSchema = z.object({
  feed_instance_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
  source_url: z.string().url(),
  image_url: z.string().url().optional(),
  published_at: z.string().datetime(),
  detected_language: LanguageCodeSchema,
  language_confidence: z.number().min(0).max(1).default(0.5),
  content_category: ContentCategorySchema.optional(),
  content_tags: z.array(z.string()).optional().transform(arr => arr ? JSON.stringify(arr) : undefined),
  urgency_level: UrgencyLevelSchema.default('normal'),
  word_count: z.number().int().min(0).optional()
});

export const ArticleTranslationSchema = z.object({
  id: z.string().uuid(),
  original_article_id: z.string().uuid(),
  target_language: LanguageCodeSchema,
  title_translated: z.string().min(1),
  description_translated: z.string().optional(),
  content_translated: z.string().optional(),
  summary_translated: z.string().optional(),
  translation_method: TranslationMethodSchema,
  translator_model: z.string().optional(),
  translation_quality_score: z.number().min(0).max(1).optional(),
  translation_confidence: z.number().min(0).max(1).optional(),
  human_reviewed: z.boolean(),
  translation_started_at: z.string().datetime().optional(),
  translation_completed_at: z.string().datetime().optional(),
  translation_status: TranslationStatusSchema,
  error_message: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateTranslationRequestSchema = z.object({
  original_article_id: z.string().uuid(),
  target_languages: z.array(LanguageCodeSchema).min(1).max(6),
  priority: JobPrioritySchema.default('normal'),
  translation_method: TranslationMethodSchema.default('ai'),
  translator_model: z.string().optional()
});

// ============================================
// TRANSLATION JOB SCHEMAS
// ============================================

export const TranslationJobSchema = z.object({
  id: z.string().uuid(),
  original_article_id: z.string().uuid(),
  target_languages: z.string(), // JSON array
  priority: JobPrioritySchema,
  status: JobStatusSchema,
  assigned_worker: z.string().optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  estimated_completion: z.string().datetime().optional(),
  translation_config: z.string().optional(), // JSON
  max_retries: z.number().int().min(0).max(10),
  retry_count: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateTranslationJobSchema = z.object({
  original_article_id: z.string().uuid(),
  target_languages: z.array(LanguageCodeSchema).min(1).max(6)
    .transform(langs => JSON.stringify(langs)),
  priority: JobPrioritySchema.default('normal'),
  translation_config: z.object({
    model: z.string().optional(),
    quality_threshold: z.number().min(0).max(1).optional(),
    human_review_required: z.boolean().optional()
  }).optional().transform(config => config ? JSON.stringify(config) : undefined),
  max_retries: z.number().int().min(0).max(10).default(3)
});

// ============================================
// HEALTH MONITORING SCHEMAS
// ============================================

export const FeedHealthMetricSchema = z.object({
  id: z.number().int(),
  feed_instance_id: z.string().uuid(),
  check_timestamp: z.string().datetime(),
  response_time_ms: z.number().int().min(0).optional(),
  articles_found: z.number().int().min(0),
  articles_new: z.number().int().min(0),
  articles_duplicates: z.number().int().min(0),
  is_available: z.boolean(),
  http_status: z.number().int().min(100).max(599).optional(),
  error_type: z.string().optional(),
  error_message: z.string().optional(),
  avg_content_length: z.number().min(0).optional(),
  avg_language_confidence: z.number().min(0).max(1).optional(),
  content_quality_distribution: z.string().optional(), // JSON
  optimal_refresh_minutes: z.number().int().min(1).max(1440).optional(),
  recommended_action: RecommendedActionSchema.optional(),
  created_at: z.string().datetime()
});

export const CreateHealthMetricSchema = z.object({
  feed_instance_id: z.string().uuid(),
  response_time_ms: z.number().int().min(0).optional(),
  articles_found: z.number().int().min(0).default(0),
  articles_new: z.number().int().min(0).default(0),
  articles_duplicates: z.number().int().min(0).default(0),
  is_available: z.boolean(),
  http_status: z.number().int().min(100).max(599).optional(),
  error_type: z.string().optional(),
  error_message: z.string().optional(),
  avg_content_length: z.number().min(0).optional(),
  avg_language_confidence: z.number().min(0).max(1).optional(),
  content_quality_distribution: z.object({
    high: z.number().int().min(0),
    medium: z.number().int().min(0),
    low: z.number().int().min(0),
    failed: z.number().int().min(0)
  }).optional().transform(dist => dist ? JSON.stringify(dist) : undefined)
});

// ============================================
// API REQUEST/RESPONSE SCHEMAS
// ============================================

export const FeedQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  language: LanguageCodeSchema.optional(),
  category: ContentCategorySchema.optional(),
  provider: ProviderTypeSchema.optional(),
  active: z.string().regex(/^(true|false)$/).transform(s => s === 'true').optional(),
  refresh_tier: RefreshTierSchema.optional()
});

export const ArticleQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('50'),
  language: LanguageCodeSchema.optional(),
  category: ContentCategorySchema.optional(),
  urgency: UrgencyLevelSchema.optional(),
  quality: ContentQualitySchema.optional(),
  stage: ProcessingStageSchema.optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional()
});

export const TranslationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  source_language: LanguageCodeSchema.optional(),
  target_language: LanguageCodeSchema.optional(),
  status: TranslationStatusSchema.optional(),
  method: TranslationMethodSchema.optional(),
  min_quality: z.string().regex(/^0\.\d+$/).transform(Number).optional()
});

// ============================================
// RESPONSE SCHEMAS
// ============================================

export const PaginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(0)
    })
  });

export const FeedPerformanceSummarySchema = z.object({
  id: z.string().uuid(),
  source_name: z.string(),
  instance_name: z.string(),
  source_language: LanguageCodeSchema,
  content_category: ContentCategorySchema,
  refresh_tier: RefreshTierSchema,
  reliability_score: z.number().min(0).max(1),
  total_articles_24h: z.number().int().min(0),
  high_quality_articles: z.number().int().min(0),
  avg_response_time: z.number().min(0).nullable(),
  last_successful_fetch: z.string().datetime().nullable()
});

export const TranslationPipelineStatusSchema = z.object({
  content_category: ContentCategorySchema.nullable(),
  source_lang: LanguageCodeSchema,
  total_articles: z.number().int().min(0),
  translated: z.number().int().min(0),
  queued_jobs: z.number().int().min(0),
  processing_jobs: z.number().int().min(0),
  avg_translation_quality: z.number().min(0).max(1).nullable()
});

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  database: z.boolean(),
  feeds: z.object({
    total: z.number().int().min(0),
    active: z.number().int().min(0),
    healthy: z.number().int().min(0)
  }),
  translations: z.object({
    queued: z.number().int().min(0),
    processing: z.number().int().min(0),
    avg_quality: z.number().min(0).max(1).nullable()
  }),
  uptime: z.number().min(0),
  timestamp: z.string().datetime()
});

// ============================================
// EXPORT TYPES
// ============================================

export type LanguageCode = z.infer<typeof LanguageCodeSchema>;
export type ProviderType = z.infer<typeof ProviderTypeSchema>;
export type ContentCategory = z.infer<typeof ContentCategorySchema>;
export type ContentType = z.infer<typeof ContentTypeSchema>;
export type RefreshTier = z.infer<typeof RefreshTierSchema>;
export type UrgencyLevel = z.infer<typeof UrgencyLevelSchema>;
export type ContentQuality = z.infer<typeof ContentQualitySchema>;
export type ProcessingStage = z.infer<typeof ProcessingStageSchema>;
export type TranslationMethod = z.infer<typeof TranslationMethodSchema>;
export type TranslationStatus = z.infer<typeof TranslationStatusSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobPriority = z.infer<typeof JobPrioritySchema>;

export type FeedSource = z.infer<typeof FeedSourceSchema>;
export type CreateFeedSource = z.infer<typeof CreateFeedSourceSchema>;
export type UpdateFeedSource = z.infer<typeof UpdateFeedSourceSchema>;

export type FeedInstance = z.infer<typeof FeedInstanceSchema>;
export type CreateFeedInstance = z.infer<typeof CreateFeedInstanceSchema>;
export type UpdateFeedInstance = z.infer<typeof UpdateFeedInstanceSchema>;

export type ArticleOriginal = z.infer<typeof ArticleOriginalSchema>;
export type CreateArticleOriginal = z.infer<typeof CreateArticleOriginalSchema>;

export type ArticleTranslation = z.infer<typeof ArticleTranslationSchema>;
export type CreateTranslationRequest = z.infer<typeof CreateTranslationRequestSchema>;

export type TranslationJob = z.infer<typeof TranslationJobSchema>;
export type CreateTranslationJob = z.infer<typeof CreateTranslationJobSchema>;

export type FeedHealthMetric = z.infer<typeof FeedHealthMetricSchema>;
export type CreateHealthMetric = z.infer<typeof CreateHealthMetricSchema>;

export type FeedQuery = z.infer<typeof FeedQuerySchema>;
export type ArticleQuery = z.infer<typeof ArticleQuerySchema>;
export type TranslationQuery = z.infer<typeof TranslationQuerySchema>;

export type FeedPerformanceSummary = z.infer<typeof FeedPerformanceSummarySchema>;
export type TranslationPipelineStatus = z.infer<typeof TranslationPipelineStatusSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;