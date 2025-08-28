import { z } from 'zod';
import { LanguageSchema, CategorySchema } from '../../types/index.js';

/**
 * RSS Feed API Schemas
 * Contract-first API design following CLAUDE.md guidelines
 */

// Base feed schema
export const FeedSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  url: z.string().url(),
  category: CategorySchema,
  language: LanguageSchema,
  isActive: z.boolean(),
  lastFetched: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  description: z.string().optional()
});

// Request schemas
export const CreateFeedRequestSchema = z.object({
  name: z.string().min(1).max(255),
  url: z.string().url(),
  category: CategorySchema,
  language: LanguageSchema.default('english'),
  description: z.string().optional()
});

export const UpdateFeedRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().optional(),
  category: CategorySchema.optional(),
  language: LanguageSchema.optional(),
  isActive: z.boolean().optional(),
  description: z.string().optional()
});

export const TestFeedRequestSchema = z.object({
  url: z.string().url()
});

// Google RSS generation schema
export const GoogleRSSRequestSchema = z.object({
  mode: z.enum(['topic', 'search']),
  topic: z.string().optional(),
  searchQuery: z.string().optional(),
  country: z.string().length(2), // ISO country code
  language: z.string().length(2), // ISO language code
  timeFrame: z.string().optional(),
  feedName: z.string().min(1).max(255)
}).refine(
  (data) => data.mode === 'topic' ? !!data.topic : !!data.searchQuery,
  { message: "Either topic or searchQuery is required based on mode" }
);

// Response schemas
export const FeedsListResponseSchema = z.object({
  feeds: z.array(FeedSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0)
  })
});

export const FeedTestResponseSchema = z.object({
  isValid: z.boolean(),
  error: z.string().optional(),
  articleCount: z.number().int().min(0).optional(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    language: z.string().optional()
  }).optional()
});

export const GoogleRSSResponseSchema = z.object({
  url: z.string().url(),
  feedName: z.string(),
  saved: z.boolean(),
  feedId: z.string().uuid().optional()
});

// Query parameter schemas
export const FeedsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  category: CategorySchema.optional(),
  language: LanguageSchema.optional(),
  active: z.string().regex(/^(true|false)$/).transform(s => s === 'true').optional()
});

// Export types
export type Feed = z.infer<typeof FeedSchema>;
export type CreateFeedRequest = z.infer<typeof CreateFeedRequestSchema>;
export type UpdateFeedRequest = z.infer<typeof UpdateFeedRequestSchema>;
export type TestFeedRequest = z.infer<typeof TestFeedRequestSchema>;
export type GoogleRSSRequest = z.infer<typeof GoogleRSSRequestSchema>;
export type FeedsListResponse = z.infer<typeof FeedsListResponseSchema>;
export type FeedTestResponse = z.infer<typeof FeedTestResponseSchema>;
export type GoogleRSSResponse = z.infer<typeof GoogleRSSResponseSchema>;
export type FeedsQuery = z.infer<typeof FeedsQuerySchema>;