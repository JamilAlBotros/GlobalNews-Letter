import { z } from 'zod';

/**
 * RSS Polling API Schemas  
 * Contract-first API design following CLAUDE.md guidelines
 */

// Polling status response
export const PollingStatusResponseSchema = z.object({
  isRunning: z.boolean(),
  intervalMinutes: z.number().int().min(1),
  totalFeeds: z.number().int().min(0),
  activeFeeds: z.number().int().min(0),
  lastPollAt: z.string().datetime().nullable(),
  nextPollAt: z.string().datetime().nullable(),
  totalArticles: z.number().int().min(0),
  configuration: z.object({
    maxArticles: z.number().int().min(1),
    maxArticleAgeDays: z.number().int().min(1),
    enableContentExtraction: z.boolean(),
    enableLanguageDetection: z.boolean(),
    enableHealthTracking: z.boolean()
  })
});

// Polling control request
export const PollingControlRequestSchema = z.object({
  intervalMinutes: z.number().int().min(1).max(1440).optional(), // Max 24 hours
  maxArticles: z.number().int().min(100).max(10000).optional(),
  maxArticleAgeDays: z.number().int().min(1).max(365).optional()
});

// Recent articles response
export const RecentArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  link: z.string().url(),
  feedName: z.string(),
  pubDate: z.string().datetime(),
  createdAt: z.string().datetime(),
  // Enhanced metadata
  detectedLanguage: z.string().optional(),
  languageConfidence: z.number().min(0).max(1).optional(),
  wordCount: z.number().int().min(0).optional(),
  hasImages: z.boolean().optional(),
  contentExtracted: z.boolean().optional()
});

export const RecentArticlesResponseSchema = z.object({
  articles: z.array(RecentArticleSchema),
  count: z.number().int().min(0)
});

// Query parameters
export const RecentArticlesQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).default('10'),
  feedId: z.string().uuid().optional()
});

// Export types
export type PollingStatusResponse = z.infer<typeof PollingStatusResponseSchema>;
export type PollingControlRequest = z.infer<typeof PollingControlRequestSchema>;
export type RecentArticle = z.infer<typeof RecentArticleSchema>;
export type RecentArticlesResponse = z.infer<typeof RecentArticlesResponseSchema>;
export type RecentArticlesQuery = z.infer<typeof RecentArticlesQuerySchema>;