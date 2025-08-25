import { NewsAPIProvider } from '../providers/newsapi.js';
import { ErrorHandler, ExternalServiceError, ValidationError } from '../utils/errors.js';
import type { 
  NewsAPIArticle, 
  Category, 
  Language,
  FilterOptions,
  NewsAPIResponse
} from '../types/index.js';

/**
 * Service focused solely on fetching articles from NewsAPI
 * Extracted from ArticleService for single responsibility
 */
export class ArticleFetchService {
  private newsAPI: NewsAPIProvider;

  constructor() {
    this.newsAPI = new NewsAPIProvider();
  }

  /**
   * Fetch articles by category from NewsAPI
   */
  async fetchByCategory(
    category: Category, 
    language: Language = 'english'
  ): Promise<NewsAPIResponse> {
    if (!category) {
      throw new ValidationError('Category is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        console.log(`Fetching ${category} articles in ${language}...`);
        return await this.newsAPI.fetchByCategory(category, language);
      },
      `ArticleFetchService.fetchByCategory(${category}, ${language})`
    );
  }

  /**
   * Search articles with keyword from NewsAPI
   */
  async searchArticles(
    keyword: string,
    options: Omit<FilterOptions, 'keyword'> = { sortBy: 'publishedAt' }
  ): Promise<NewsAPIResponse> {
    if (!keyword || keyword.trim().length === 0) {
      throw new ValidationError('Search keyword is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        console.log(`Searching articles for: "${keyword}"`);
        return await this.newsAPI.searchArticles(keyword, options);
      },
      `ArticleFetchService.searchArticles(${keyword})`
    );
  }

  /**
   * Fetch top headlines by category from NewsAPI
   */
  async fetchTopHeadlines(
    category: Category,
    language: Language = 'english'
  ): Promise<NewsAPIResponse> {
    if (!category) {
      throw new ValidationError('Category is required');
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        console.log(`Fetching top ${category} headlines in ${language}...`);
        return await this.newsAPI.getTopHeadlines(category, language);
      },
      `ArticleFetchService.fetchTopHeadlines(${category}, ${language})`
    );
  }

  /**
   * Test NewsAPI connectivity
   */
  async testConnection(): Promise<boolean> {
    return ErrorHandler.withErrorHandling(
      async () => {
        return await this.newsAPI.testConnection();
      },
      'ArticleFetchService.testConnection'
    );
  }

  /**
   * Determine article category based on keyword (simple heuristic)
   */
  determineCategory(keyword: string): Category {
    const lowerKeyword = keyword.toLowerCase();
    
    const financeKeywords = ['finance', 'money', 'bank', 'investment', 'stock', 'crypto', 'economy'];
    const techKeywords = ['technology', 'tech', 'software', 'ai', 'startup', 'programming', 'computer'];
    
    const isFinance = financeKeywords.some(k => lowerKeyword.includes(k));
    const isTech = techKeywords.some(k => lowerKeyword.includes(k));
    
    if (isFinance && !isTech) return 'finance';
    if (isTech && !isFinance) return 'tech';
    
    // Default to tech if both or neither match
    return 'tech';
  }
}