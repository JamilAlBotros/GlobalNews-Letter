import { z } from 'zod';
import { LanguageSchema, CategorySchema, FilterOptionsSchema } from './index.js';

/**
 * Extended filter options for database queries
 * Includes additional fields that are not part of NewsAPI filters
 */
export const DatabaseFilterOptionsSchema = FilterOptionsSchema.extend({
  category: CategorySchema.optional(), // Single category filter for database
  isSelected: z.boolean().optional(),
  fromDate: z.date().optional(), // Alias for dateFrom
  toDate: z.date().optional(), // Alias for dateTo
  sortOrder: z.enum(['ASC', 'DESC']).optional().default('DESC'),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

export type DatabaseFilterOptions = z.infer<typeof DatabaseFilterOptionsSchema>;

/**
 * Database article representation (with string dates for SQLite)
 */
export const DatabaseArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string(), // ISO string in database
  content: z.string().nullable(),
  category: z.string(),
  source: z.string().nullable(),
  summary: z.string().nullable(),
  language: z.string(),
  originalLanguage: z.string(),
  isSelected: z.number(), // SQLite boolean as integer
  createdAt: z.string(), // ISO string in database
  updatedAt: z.string().optional(), // ISO string in database
});

export type DatabaseArticle = z.infer<typeof DatabaseArticleSchema>;

/**
 * Database RSS feed representation (with string dates for SQLite)
 */
export const DatabaseRSSFeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  category: z.string().nullable(),
  language: z.string().nullable(),
  description: z.string().nullable(),
  isActive: z.number(), // SQLite boolean as integer
  lastFetched: z.string().nullable(), // ISO string in database
  errorCount: z.number().default(0),
  lastError: z.string().nullable(),
  createdAt: z.string(), // ISO string in database
  updatedAt: z.string().optional(), // ISO string in database
});

export type DatabaseRSSFeed = z.infer<typeof DatabaseRSSFeedSchema>;