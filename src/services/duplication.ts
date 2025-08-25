import type { DatabaseService } from './database.js';
import { ErrorHandler, DatabaseError, ValidationError } from '../utils/errors.js';
import type { Article } from '../types/index.js';

/**
 * Service for handling article duplication checks
 * Extracted from ArticleService to eliminate code duplication
 */
export class DuplicationService {
  private database: DatabaseService;

  constructor(database: DatabaseService) {
    this.database = database;
  }

  /**
   * Check for duplicates and return only new articles
   */
  async filterDuplicates(articles: Article[]): Promise<Article[]> {
    if (!Array.isArray(articles)) {
      throw new ValidationError('Articles must be an array');
    }

    if (articles.length === 0) {
      return [];
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        const duplicateChecks = await Promise.all(
          articles.map(async (article) => ({
            article,
            exists: await this.database.articleExists(article.url)
          }))
        );

        return duplicateChecks
          .filter(check => !check.exists)
          .map(check => check.article);
      },
      `DuplicationService.filterDuplicates(${articles.length} articles)`
    );
  }

  /**
   * Check if a single article is a duplicate
   */
  async isDuplicate(article: Article): Promise<boolean> {
    if (!article || !article.url) {
      throw new ValidationError('Article with valid URL is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        return await this.database.articleExists(article.url);
      },
      `DuplicationService.isDuplicate(${article.url})`
    );
  }

  /**
   * Get statistics about duplication checking
   */
  async getDuplicationStats(articles: Article[]): Promise<{
    total: number;
    duplicates: number;
    newArticles: number;
  }> {
    if (!Array.isArray(articles)) {
      throw new ValidationError('Articles must be an array');
    }

    if (articles.length === 0) {
      return { total: 0, duplicates: 0, newArticles: 0 };
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        const duplicateChecks = await Promise.all(
          articles.map(article => this.database.articleExists(article.url))
        );

        const duplicates = duplicateChecks.filter(Boolean).length;
        
        return {
          total: articles.length,
          duplicates,
          newArticles: articles.length - duplicates
        };
      },
      `DuplicationService.getDuplicationStats(${articles.length} articles)`
    );
  }
}