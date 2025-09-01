import { z } from 'zod';

// Enhanced language support with comprehensive list
export const LanguageSchema = z.enum(['en', 'es', 'pt', 'fr', 'ar', 'zh', 'ja']);
export type Language = z.infer<typeof LanguageSchema>;

// Map language codes to full names
export const LanguageNames: Record<Language, string> = {
  'en': 'English',
  'es': 'Spanish', 
  'pt': 'Portuguese',
  'fr': 'French',
  'ar': 'Arabic',
  'zh': 'Chinese',
  'ja': 'Japanese'
} as const;

// Article categories
export const CategorySchema = z.enum(['finance', 'tech']);
export type Category = z.infer<typeof CategorySchema>;

// External API Article schemas (NewsAPI format)
export const NewsAPIArticleSchema = z.object({
  source: z.object({
    id: z.string().nullable(),
    name: z.string(),
  }),
  author: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  url: z.string().url(),
  urlToImage: z.string().url().nullable(),
  publishedAt: z.string(),
  content: z.string().nullable(),
});

export type NewsAPIArticle = z.infer<typeof NewsAPIArticleSchema>;

export const NewsAPIResponseSchema = z.object({
  status: z.string(),
  totalResults: z.number(),
  articles: z.array(NewsAPIArticleSchema),
});

export type NewsAPIResponse = z.infer<typeof NewsAPIResponseSchema>;

// Internal Article schema (after processing)
export const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string().url(),
  imageUrl: z.string().url().nullable(),
  publishedAt: z.date(),
  content: z.string().nullable(),
  category: CategorySchema,
  source: z.string(),
  summary: z.string().nullable(), // AI-generated summary
  language: LanguageSchema,
  originalLanguage: LanguageSchema,
  isSelected: z.boolean().default(false),
  createdAt: z.date(),
});

export type Article = z.infer<typeof ArticleSchema>;

// Database schemas (SQLite format) - matches actual DB schema
export const DatabaseArticleSchema = z.object({
  id: z.string(),
  feed_id: z.string(),
  detected_language: z.string().nullable(),
  needs_manual_language_review: z.number().nullable(), // SQLite boolean as 0/1
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  url: z.string(),
  published_at: z.string(),
  scraped_at: z.string(),
  created_at: z.string(),
  // Enhanced fields from Phase 1
  summary: z.string().nullable(),
  original_language: z.string().nullable(),
});

export type DatabaseArticle = z.infer<typeof DatabaseArticleSchema>;

// Newsletter schemas
export const NewsletterArticleSchema = z.object({
  title: z.string(),
  author: z.string().nullable(),
  link: z.string().url(),
  summary: z.string(),
});

export const NewsletterSchema = z.object({
  generatedAt: z.date(),
  language: LanguageSchema,
  articles: z.array(NewsletterArticleSchema),
});

export type Newsletter = z.infer<typeof NewsletterSchema>;
export type NewsletterArticle = z.infer<typeof NewsletterArticleSchema>;

// RSS Feed schemas
export const RSSFeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  category: CategorySchema,
  language: LanguageSchema,
  isActive: z.boolean().default(true),
  lastFetched: z.date().nullable(),
  createdAt: z.date(),
  description: z.string().optional(),
});

export type RSSFeed = z.infer<typeof RSSFeedSchema>;

// Database RSS Feed schema - matches actual DB schema
export const DatabaseRSSFeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  language: z.string(),
  region: z.string(),
  category: z.string(),
  type: z.string(),
  is_active: z.number(), // SQLite stores boolean as 0/1
  created_at: z.string(),
  updated_at: z.string(),
  // Enhanced fields (may not exist in all records)
  last_fetched: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
});

export type DatabaseRSSFeed = z.infer<typeof DatabaseRSSFeedSchema>;

// RSS Article schema (from RSS parser)
export const RSSArticleSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  pubDate: z.string().optional(),
  author: z.string().optional(),
  content: z.string().optional(),
  contentSnippet: z.string().optional(),
  guid: z.string().optional(),
  categories: z.array(z.string()).optional(),
  enclosure: z.object({
    url: z.string().url(),
    type: z.string(),
  }).optional(),
});

export type RSSArticle = z.infer<typeof RSSArticleSchema>;

// RSS Feed metadata
export const RSSFeedMetadataSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  link: z.string().url().optional(),
  language: z.string().optional(),
  lastBuildDate: z.string().optional(),
  generator: z.string().optional(),
});

export type RSSFeedMetadata = z.infer<typeof RSSFeedMetadataSchema>;

// Filter options for articles
export const FilterOptionsSchema = z.object({
  categories: z.array(CategorySchema).optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
  sources: z.array(z.string()).optional(),
  language: LanguageSchema.optional(),
  keyword: z.string().optional(),
  sortBy: z.enum(['relevancy', 'popularity', 'publishedAt']).optional().default('publishedAt'),
});

export type FilterOptions = z.infer<typeof FilterOptionsSchema>;

// Database filter options (with string dates)
export const DatabaseFilterOptionsSchema = z.object({
  categories: z.array(z.string()).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sources: z.array(z.string()).optional(),
  language: z.string().optional(),
  keyword: z.string().optional(),
  sortBy: z.enum(['relevancy', 'popularity', 'publishedAt']).optional().default('publishedAt'),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type DatabaseFilterOptions = z.infer<typeof DatabaseFilterOptionsSchema>;

// LLM API schemas
export const LLMRequestSchema = z.object({
  content: z.string(),
  action: z.enum(['summarize', 'translate', 'detect-language']),
  targetLanguage: LanguageSchema.optional(),
  sourceLanguage: LanguageSchema.optional(),
  maxLength: z.number().optional().default(150),
  style: z.enum(['brief', 'detailed', 'bullet-points']).optional(),
});

export type LLMRequest = z.infer<typeof LLMRequestSchema>;

export const LLMResponseSchema = z.object({
  result: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  detectedLanguage: LanguageSchema.optional(),
  processingTimeMs: z.number().optional(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
  }).optional(),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// Translation specific schemas
export const TranslationRequestSchema = z.object({
  text: z.string(),
  sourceLanguage: LanguageSchema,
  targetLanguage: LanguageSchema,
  contentType: z.enum(['title', 'description', 'content', 'summary']).optional(),
  context: z.string().optional(),
});

export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;

export const TranslationResponseSchema = z.object({
  translatedText: z.string(),
  qualityScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  detectedLanguage: LanguageSchema.optional(),
  model: z.string(),
  processingTimeMs: z.number(),
});

export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;

// Summarization schemas
export const SummarizationRequestSchema = z.object({
  text: z.string(),
  language: LanguageSchema,
  maxLength: z.number(),
  style: z.enum(['brief', 'detailed', 'bullet-points']).optional(),
});

export type SummarizationRequest = z.infer<typeof SummarizationRequestSchema>;

export const SummarizationResponseSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()).optional(),
  model: z.string(),
  processingTimeMs: z.number(),
});

export type SummarizationResponse = z.infer<typeof SummarizationResponseSchema>;

// Health and status schemas
export const ServiceHealthSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  responseTimeMs: z.number().optional(),
  lastChecked: z.date().optional(),
  errors: z.array(z.string()).optional(),
});

export type ServiceHealth = z.infer<typeof ServiceHealthSchema>;

export const SystemHealthSchema = z.object({
  overall: z.enum(['healthy', 'degraded', 'unhealthy']),
  services: z.record(z.string(), ServiceHealthSchema),
  timestamp: z.date(),
});

export type SystemHealth = z.infer<typeof SystemHealthSchema>;

// API Error schemas
export const APIErrorSchema = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export type APIError = z.infer<typeof APIErrorSchema>;

// Utility type guards
export const isLanguageCode = (value: string): value is Language => {
  return LanguageSchema.safeParse(value).success;
};

export const isCategoryCode = (value: string): value is Category => {
  return CategorySchema.safeParse(value).success;
};

// Transformation utilities
// Note: Database schema differs significantly from application schema
// These functions would need adaptation based on actual business needs

// Transformation functions would go here when needed
// For now, work directly with database types in repositories