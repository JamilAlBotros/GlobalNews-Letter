import { ArticleRepository } from '../database/article-repository.js';
import { ErrorHandler, DatabaseError, ValidationError, NotFoundError } from '../utils/errors.js';
import type { DatabaseFilterOptions } from '../types/database.js';
import type { 
  Article, 
  Category, 
  FilterOptions 
} from '../types/index.js';

/**
 * Service focused on article storage and retrieval operations
 * Uses repository pattern for better separation of concerns
 */
export class ArticleStorageService {
  private repository: ArticleRepository;

  constructor() {
    this.repository = new ArticleRepository();
    this.repository.initialize().catch(error => {
      console.error('Failed to initialize ArticleRepository:', error);
    });
  }

  /**
   * Save multiple articles to database
   */
  async saveArticles(articles: Article[]): Promise<void> {
    if (!Array.isArray(articles)) {
      throw new ValidationError('Articles must be an array');
    }

    if (articles.length === 0) {
      console.log('No articles to save');
      return;
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        await this.repository.saveArticles(articles);
        console.log(`Saved ${articles.length} articles to database`);
      },
      `ArticleStorageService.saveArticles(${articles.length} articles)`
    );
  }

  /**
   * Save a single article to database
   */
  async saveArticle(article: Article): Promise<void> {
    if (!article || !article.id || !article.url) {
      throw new ValidationError('Valid article with ID and URL is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        await this.repository.saveArticle(article);
        console.log(`Saved article: ${article.title}`);
      },
      `ArticleStorageService.saveArticle(${article.id})`
    );
  }

  /**
   * Get stored articles with optional filters
   */
  async getArticles(filters: Partial<DatabaseFilterOptions> = {}): Promise<Article[]> {
    return ErrorHandler.withErrorHandling(
      async () => {
        return await this.repository.getArticles(filters);
      },
      'ArticleStorageService.getArticles'
    );
  }

  /**
   * Get article by ID
   */
  async getArticleById(articleId: string): Promise<Article | null> {
    if (!articleId || articleId.trim().length === 0) {
      throw new ValidationError('Article ID is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        return await this.repository.getArticleById(articleId);
      },
      `ArticleStorageService.getArticleById(${articleId})`
    );
  }

  /**
   * Check if article exists by URL
   */
  async articleExists(url: string): Promise<boolean> {
    if (!url || url.trim().length === 0) {
      throw new ValidationError('URL is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        return await this.repository.articleExists(url);
      },
      `ArticleStorageService.articleExists(${url})`
    );
  }

  /**
   * Select articles for newsletter
   */
  async selectArticles(articleIds: string[]): Promise<void> {
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      throw new ValidationError('Article IDs array is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        await this.repository.updateSelectionStatus(articleIds, true);
        console.log(`Selected ${articleIds.length} articles for newsletter`);
      },
      `ArticleStorageService.selectArticles(${articleIds.length} articles)`
    );
  }

  /**
   * Unselect articles from newsletter
   */
  async unselectArticles(articleIds: string[]): Promise<void> {
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      throw new ValidationError('Article IDs array is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        await this.repository.updateSelectionStatus(articleIds, false);
        console.log(`Unselected ${articleIds.length} articles from newsletter`);
      },
      `ArticleStorageService.unselectArticles(${articleIds.length} articles)`
    );
  }

  /**
   * Get selected articles for newsletter generation
   */
  async getSelectedArticles(): Promise<Article[]> {
    return ErrorHandler.withErrorHandling(
      async () => {
        return await this.repository.getSelectedArticles();
      },
      'ArticleStorageService.getSelectedArticles'
    );
  }

  /**
   * Clear all article selections
   */
  async clearAllSelections(): Promise<void> {
    return ErrorHandler.withErrorHandling(
      async () => {
        await this.repository.clearAllSelections();
        console.log('Cleared all article selections');
      },
      'ArticleStorageService.clearAllSelections'
    );
  }

  /**
   * Get article statistics by category
   */
  async getArticleStats(): Promise<Record<Category, number>> {
    return ErrorHandler.withErrorHandling(
      async () => {
        return await this.repository.getArticleStats();
      },
      'ArticleStorageService.getArticleStats'
    );
  }

  /**
   * Clean up old articles (older than specified days)
   */
  async cleanupOldArticles(days: number = 30): Promise<number> {
    if (days <= 0) {
      throw new ValidationError('Days must be a positive number');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        const deletedCount = await this.repository.cleanupOldArticles(days);
        console.log(`Cleaned up ${deletedCount} old articles`);
        return deletedCount;
      },
      `ArticleStorageService.cleanupOldArticles(${days} days)`
    );
  }

  /**
   * Get article count statistics
   */
  async getStorageStats(): Promise<{
    totalArticles: number;
    selectedArticles: number;
    categoryCounts: Record<Category, number>;
  }> {
    const [allArticles, selectedArticles, categoryStats] = await Promise.all([
      this.getArticles(),
      this.getSelectedArticles(),
      this.getArticleStats()
    ]);

    return {
      totalArticles: allArticles.length,
      selectedArticles: selectedArticles.length,
      categoryCounts: categoryStats
    };
  }

  /**
   * Batch update article selection status
   */
  async batchUpdateSelection(
    articleIds: string[], 
    isSelected: boolean
  ): Promise<void> {
    if (isSelected) {
      await this.selectArticles(articleIds);
    } else {
      await this.unselectArticles(articleIds);
    }
  }
}