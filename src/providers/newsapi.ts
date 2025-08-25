import { z } from 'zod';
import type { 
  NewsAPIResponse, 
  FilterOptions, 
  Category,
  Language 
} from '../types/index.js';
import { NewsAPIResponseSchema } from '../types/index.js';
import { appConfig, CATEGORY_QUERIES, NEWS_API_LANGUAGES, PREFERRED_SOURCES } from '../config/index.js';

export class NewsAPIProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = appConfig.NEWSAPI_API_KEY;
    this.baseUrl = appConfig.NEWSAPI_BASE_URL;
  }

  /**
   * Fetch articles from NewsAPI based on filter options
   */
  async fetchArticles(options: FilterOptions): Promise<NewsAPIResponse> {
    const url = this.buildUrl(options);
    
    try {
      const response = await fetch(url, {
        headers: {
          'X-API-Key': this.apiKey,
          'User-Agent': 'GlobalNewsLetter/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return NewsAPIResponseSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`NewsAPI response validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Get articles for specific categories
   */
  async fetchByCategory(category: Category, language: Language = 'english'): Promise<NewsAPIResponse> {
    const queries = CATEGORY_QUERIES[category];
    const query = queries.join(' OR ');
    
    return this.fetchArticles({
      keyword: query,
      language,
      sortBy: 'publishedAt',
      sources: [...PREFERRED_SOURCES[category]],
    });
  }

  /**
   * Search articles with keyword
   */
  async searchArticles(
    keyword: string, 
    options: Omit<FilterOptions, 'keyword'> = { sortBy: 'publishedAt' }
  ): Promise<NewsAPIResponse> {
    return this.fetchArticles({
      ...options,
      keyword,
    });
  }

  /**
   * Get top headlines by category
   */
  async getTopHeadlines(category: Category, language: Language = 'english'): Promise<NewsAPIResponse> {
    const url = new URL(`${this.baseUrl}/top-headlines`);
    
    url.searchParams.set('apiKey', this.apiKey);
    url.searchParams.set('language', NEWS_API_LANGUAGES[language]);
    url.searchParams.set('pageSize', '50');
    
    // Add category-specific sources
    const sources = PREFERRED_SOURCES[category];
    if (sources.length > 0) {
      url.searchParams.set('sources', sources.join(','));
    }

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'GlobalNewsLetter/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`NewsAPI request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return NewsAPIResponseSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`NewsAPI response validation failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Build URL for /everything endpoint
   */
  private buildUrl(options: FilterOptions): string {
    const url = new URL(`${this.baseUrl}/everything`);
    
    url.searchParams.set('apiKey', this.apiKey);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('sortBy', options.sortBy || 'publishedAt');

    if (options.keyword) {
      url.searchParams.set('q', options.keyword);
    }

    if (options.language) {
      url.searchParams.set('language', NEWS_API_LANGUAGES[options.language]);
    }

    if (options.dateFrom) {
      url.searchParams.set('from', options.dateFrom.toISOString().split('T')[0]!);
    }

    if (options.dateTo) {
      url.searchParams.set('to', options.dateTo.toISOString().split('T')[0]!);
    }

    if (options.sources && options.sources.length > 0) {
      url.searchParams.set('sources', options.sources.join(','));
    }

    return url.toString();
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.fetchArticles({
        keyword: 'test',
        sortBy: 'publishedAt'
      });
      return response.status === 'ok';
    } catch {
      return false;
    }
  }
}