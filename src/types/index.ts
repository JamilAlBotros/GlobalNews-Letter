import { z } from 'zod';

// Language support
export const LanguageSchema = z.enum(['english', 'spanish', 'arabic']);
export type Language = z.infer<typeof LanguageSchema>;

// Article categories
export const CategorySchema = z.enum(['finance', 'tech']);
export type Category = z.infer<typeof CategorySchema>;

// NewsAPI Article schema
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

// Newsletter schema
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

// API Response schemas
export const NewsAPIResponseSchema = z.object({
  status: z.string(),
  totalResults: z.number(),
  articles: z.array(NewsAPIArticleSchema),
});

export type NewsAPIResponse = z.infer<typeof NewsAPIResponseSchema>;

// Filter options
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

// LLM API schemas
export const LLMRequestSchema = z.object({
  content: z.string(),
  action: z.enum(['summarize', 'translate']),
  targetLanguage: LanguageSchema.optional(),
  maxLength: z.number().optional().default(150),
});

export type LLMRequest = z.infer<typeof LLMRequestSchema>;

export const LLMResponseSchema = z.object({
  result: z.string(),
  usage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
  }).optional(),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// Database schemas
export const DatabaseArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  author: z.string().nullable(),
  description: z.string().nullable(),
  url: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: z.string(), // SQLite stores as ISO string
  content: z.string().nullable(),
  category: z.string(),
  source: z.string(),
  summary: z.string().nullable(),
  language: z.string(),
  originalLanguage: z.string(),
  isSelected: z.number(), // SQLite stores boolean as 0/1
  createdAt: z.string(), // SQLite stores as ISO string
});

export type DatabaseArticle = z.infer<typeof DatabaseArticleSchema>;

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

// Database RSS Feed schema
export const DatabaseRSSFeedSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  category: z.string(),
  language: z.string(),
  isActive: z.number(), // SQLite stores boolean as 0/1
  lastFetched: z.string().nullable(), // SQLite stores as ISO string
  createdAt: z.string(), // SQLite stores as ISO string
  description: z.string().nullable(),
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