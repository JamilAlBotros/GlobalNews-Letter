import { randomUUID } from 'crypto';
import { ArticleFetchService } from './article-fetch.js';
import { ArticleProcessingService } from './article-processing.js';
import { ArticleStorageService } from './article-storage.js';
import { DuplicationService } from './duplication.js';
import { LLMService } from './llm.js';
import { DatabaseService } from './database.js';
import { RSSService } from './rss.js';
import type { 
  Article, 
  Category, 
  Language,
  FilterOptions,
  RSSFeed,
  NewsAPIArticle
} from '../types/index.js';

/**
 * Orchestration service that coordinates focused article services
 * Refactored to use single-responsibility services
 */
export class ArticleService {
  private fetchService: ArticleFetchService;
  private processingService: ArticleProcessingService;
  private storageService: ArticleStorageService;
  private duplicationService: DuplicationService;
  private database: DatabaseService;
  private llmService: LLMService;
  public rssService: RSSService;

  constructor() {
    // Initialize core services
    this.llmService = new LLMService();
    this.database = new DatabaseService();
    
    // Initialize focused services
    this.fetchService = new ArticleFetchService();
    this.processingService = new ArticleProcessingService(this.llmService);
    this.storageService = new ArticleStorageService();
    this.duplicationService = new DuplicationService(this.database);
    this.rssService = new RSSService(this.database, this.llmService);
  }

  /**
   * Fetch and store articles for specific categories
   */
  async fetchArticlesByCategory(
    category: Category, 
    language: Language = 'english'
  ): Promise<Article[]> {
    try {
      const response = await this.fetchService.fetchByCategory(category, language);
      const articles = await this.processingService.processNewsAPIArticles(
        response.articles, 
        category, 
        language
      );
      
      const newArticles = await this.duplicationService.filterDuplicates(articles);
      
      if (newArticles.length > 0) {
        await this.storageService.saveArticles(newArticles);
        console.log(`Saved ${newArticles.length} new ${category} articles`);
      } else {
        console.log(`No new ${category} articles found`);
      }

      return newArticles;
    } catch (error) {
      console.error(`Failed to fetch ${category} articles:`, error);
      return [];
    }
  }

  /**
   * Search articles with custom filters
   */
  async searchAndStoreArticles(
    keyword: string,
    options: Omit<FilterOptions, 'keyword'> = { sortBy: 'publishedAt' }
  ): Promise<Article[]> {
    try {
      const response = await this.fetchService.searchArticles(keyword, options);
      
      const category = this.fetchService.determineCategory(keyword);
      const language = options.language || 'english';
      
      const articles = await this.processingService.processNewsAPIArticles(
        response.articles, 
        category, 
        language
      );
      
      const newArticles = await this.duplicationService.filterDuplicates(articles);
      
      if (newArticles.length > 0) {
        await this.storageService.saveArticles(newArticles);
        console.log(`Saved ${newArticles.length} new articles for "${keyword}"`);
      }

      return newArticles;
    } catch (error) {
      console.error(`Failed to search articles for "${keyword}":`, error);
      return [];
    }
  }

  /**
   * Fetch top headlines for a category
   */
  async fetchTopHeadlines(
    category: Category,
    language: Language = 'english'
  ): Promise<Article[]> {
    try {
      const response = await this.fetchService.fetchTopHeadlines(category, language);
      const articles = await this.processingService.processNewsAPIArticles(
        response.articles, 
        category, 
        language
      );
      
      const newArticles = await this.duplicationService.filterDuplicates(articles);
      
      if (newArticles.length > 0) {
        await this.storageService.saveArticles(newArticles);
        console.log(`Saved ${newArticles.length} top ${category} headlines`);
      }

      return newArticles;
    } catch (error) {
      console.error(`Failed to fetch top ${category} headlines:`, error);
      return [];
    }
  }

  /**
   * Get stored articles with filters
   */
  async getStoredArticles(filters: Partial<FilterOptions> = {}): Promise<Article[]> {
    return await this.storageService.getArticles(filters);
  }

  /**
   * Select articles for newsletter
   */
  async selectArticlesForNewsletter(articleIds: string[]): Promise<void> {
    await this.storageService.selectArticles(articleIds);
  }

  /**
   * Unselect articles from newsletter
   */
  async unselectArticlesFromNewsletter(articleIds: string[]): Promise<void> {
    await this.storageService.unselectArticles(articleIds);
  }

  /**
   * Get selected articles for newsletter generation
   */
  async getSelectedArticles(): Promise<Article[]> {
    return await this.storageService.getSelectedArticles();
  }

  /**
   * Clear all selections
   */
  async clearAllSelections(): Promise<void> {
    await this.storageService.clearAllSelections();
  }

  /**
   * Get article statistics
   */
  async getArticleStats(): Promise<Record<Category, number>> {
    return await this.storageService.getArticleStats();
  }

  /**
   * Translate and re-summarize existing articles
   */
  async translateArticle(articleId: string, targetLanguage: Language): Promise<Article | null> {
    const article = await this.storageService.getArticleById(articleId);
    if (!article) {
      console.error(`Article not found: ${articleId}`);
      return null;
    }

    try {
      const translatedArticle = await this.processingService.translateArticle(article, targetLanguage);
      await this.storageService.saveArticle(translatedArticle);
      console.log(`Saved translated article in ${targetLanguage}`);
      
      return translatedArticle;
    } catch (error) {
      console.error(`Failed to translate article:`, error);
      return null;
    }
  }

  /**
   * Cleanup old articles
   */
  async cleanupOldArticles(days: number = 30): Promise<number> {
    return await this.storageService.cleanupOldArticles(days);
  }

  /**
   * Fetch articles from RSS feeds
   */
  async fetchFromRSSFeeds(): Promise<Article[]> {
    return await this.rssService.fetchFromAllRSSFeeds();
  }

  /**
   * Fetch articles from specific RSS feed
   */
  async fetchFromSpecificRSSFeed(feedId: string): Promise<Article[]> {
    return await this.rssService.fetchFromRSSFeed(feedId);
  }

  /**
   * Add RSS feed subscription
   */
  async addRSSFeed(
    name: string,
    url: string,
    category?: Category,
    language?: Language,
    description?: string
  ): Promise<RSSFeed> {
    return await this.rssService.addRSSFeed(name, url, category, language, description);
  }

  /**
   * Remove RSS feed
   */
  async removeRSSFeed(feedId: string): Promise<boolean> {
    return await this.rssService.removeRSSFeed(feedId);
  }

  /**
   * Get all RSS feeds
   */
  async getRSSFeeds(): Promise<RSSFeed[]> {
    return await this.rssService.getAllRSSFeeds();
  }

  /**
   * Get RSS feeds by category
   */
  async getRSSFeedsByCategory(category: Category): Promise<RSSFeed[]> {
    return await this.rssService.getRSSFeedsByCategory(category);
  }

  /**
   * Import common RSS feeds
   */
  async importCommonRSSFeeds(category?: Category): Promise<number> {
    return await this.rssService.importCommonFeeds(category);
  }

  /**
   * Test service connectivity
   */
  async testServices(): Promise<{ newsAPI: boolean; llm: boolean; rssFeeds: number }> {
    const [newsAPIStatus, llmStatus] = await Promise.all([
      this.fetchService.testConnection(),
      this.llmService.testConnection()
    ]);

    const rssStats = await this.rssService.getRSSFeedStats();

    return {
      newsAPI: newsAPIStatus,
      llm: llmStatus,
      rssFeeds: rssStats.active
    };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.database.close();
  }

}