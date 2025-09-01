/**
 * Repository pattern implementation
 * Provides centralized data access layer with enhanced error handling
 */

export { BaseRepository } from './base.js';
export { ArticleRepository } from './article.js';
export { FeedRepository } from './feed.js';

// Repository instances for easy access
import { ArticleRepository } from './article.js';
import { FeedRepository } from './feed.js';

export const articleRepository = new ArticleRepository();
export const feedRepository = new FeedRepository();

// Re-export types
export type {
  CreateArticleData,
  UpdateArticleData
} from './article.js';

export type {
  CreateFeedData,
  UpdateFeedData
} from './feed.js';