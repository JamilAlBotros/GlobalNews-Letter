import { z } from 'zod';
import { LanguageSchema, CategorySchema } from '../../types/index.js';

/**
 * Article API Schemas
 * Contract-first API design following CLAUDE.md guidelines
 */

// Article schema
export const ArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string().url(),
  imageUrl: z.string().url().nullable(),
  publishedAt: z.string().datetime(),
  content: z.string().nullable(),
  category: CategorySchema,
  source: z.string(),
  summary: z.string().nullable(),
  language: LanguageSchema,
  originalLanguage: LanguageSchema,
  isSelected: z.boolean(),
  createdAt: z.string().datetime(),
  // Enhanced metadata
  feedId: z.string().optional(),
  feedName: z.string().optional(),
  detectedLanguage: z.string().optional(),
  languageConfidence: z.number().min(0).max(1).optional(),
  detectionMethod: z.string().optional(),
  wordCount: z.number().int().min(0).optional(),
  hasImages: z.boolean().optional(),
  contentExtracted: z.boolean().optional(),
  extractionSuccess: z.boolean().optional(),
  processingTime: z.number().min(0).optional()
});

// Article filters
export const ArticleFiltersQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  categories: z.string().transform(s => s.split(',').filter(Boolean)).optional(),
  language: LanguageSchema.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  sources: z.string().transform(s => s.split(',').filter(Boolean)).optional(),
  keyword: z.string().min(1).optional(),
  sortBy: z.enum(['publishedAt', 'popularity', 'title']).default('publishedAt'),
  selected: z.string().regex(/^(true|false)$/).transform(s => s === 'true').optional(),
  feedId: z.string().uuid().optional()
});

// Response schemas
export const ArticlesListResponseSchema = z.object({
  articles: z.array(ArticleSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0)
  }),
  filters: z.object({
    categories: z.array(CategorySchema).optional(),
    language: LanguageSchema.optional(),
    dateFrom: z.string().datetime().optional(),
    dateTo: z.string().datetime().optional(),
    sources: z.array(z.string()).optional(),
    keyword: z.string().optional(),
    sortBy: z.string(),
    selected: z.boolean().optional(),
    feedId: z.string().uuid().optional()
  })
});

// Article statistics
export const ArticleStatsResponseSchema = z.object({
  total: z.number().int().min(0),
  selected: z.number().int().min(0),
  byCategory: z.record(CategorySchema, z.number().int().min(0)),
  byLanguage: z.record(LanguageSchema, z.number().int().min(0)),
  bySource: z.record(z.string(), z.number().int().min(0)),
  recentCount: z.object({
    last24h: z.number().int().min(0),
    last7days: z.number().int().min(0),
    last30days: z.number().int().min(0)
  }),
  processingStats: z.object({
    totalProcessed: z.number().int().min(0),
    successfulExtractions: z.number().int().min(0),
    languageDetections: z.number().int().min(0),
    averageWordCount: z.number().min(0).optional(),
    averageProcessingTime: z.number().min(0).optional()
  })
});

// Article selection request
export const ArticleSelectionRequestSchema = z.object({
  selected: z.boolean(),
  reason: z.string().optional()
});

// Bulk selection request  
export const BulkArticleSelectionRequestSchema = z.object({
  articleIds: z.array(z.string()).min(1).max(100),
  selected: z.boolean(),
  reason: z.string().optional()
});

// Export types
export type Article = z.infer<typeof ArticleSchema>;
export type ArticleFiltersQuery = z.infer<typeof ArticleFiltersQuerySchema>;
export type ArticlesListResponse = z.infer<typeof ArticlesListResponseSchema>;
export type ArticleStatsResponse = z.infer<typeof ArticleStatsResponseSchema>;
export type ArticleSelectionRequest = z.infer<typeof ArticleSelectionRequestSchema>;
export type BulkArticleSelectionRequest = z.infer<typeof BulkArticleSelectionRequestSchema>;