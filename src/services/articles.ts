import { randomUUID } from 'crypto';
import { NewsAPIProvider } from '../providers/newsapi.js';
import { LLMService } from './llm.js';
import { DatabaseService } from './database.js';
import { RSSService } from './rss.js';
import type { 
  Article, 
  NewsAPIArticle, 
  Category, 
  Language,
  FilterOptions,
  RSSFeed
} from '../types/index.js';

/**
 * Main service for fetching, processing, and managing articles
 */
export class ArticleService {
  private newsAPI: NewsAPIProvider;
  private llmService: LLMService;
  private database: DatabaseService;
  public rssService: RSSService;

  constructor() {
    this.newsAPI = new NewsAPIProvider();
    this.llmService = new LLMService();
    this.database = new DatabaseService();
    this.rssService = new RSSService(this.database, this.llmService);
  }

  /**
   * Fetch and store articles for specific categories
   */
  async fetchArticlesByCategory(
    category: Category, 
    language: Language = 'english'
  ): Promise<Article[]> {
    console.log(`Fetching ${category} articles in ${language}...`);
    
    try {
      const response = await this.newsAPI.fetchByCategory(category, language);
      const articles = await this.processNewsAPIArticles(
        response.articles, 
        category, 
        language
      );
      
      // Filter out duplicates
      const duplicateChecks = await Promise.all(
        articles.map(async (article) => ({
          article,
          exists: await this.database.articleExists(article.url)
        }))
      );
      
      const newArticles = duplicateChecks
        .filter(check => !check.exists)
        .map(check => check.article);
      
      if (newArticles.length > 0) {
        await this.database.saveArticles(newArticles);
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
    console.log(`Searching articles for: "${keyword}"`);
    
    try {
      const response = await this.newsAPI.searchArticles(keyword, options);
      
      // Determine category based on keyword (simple heuristic)
      const category = this.determineCategory(keyword);
      const language = options.language || 'english';
      
      const articles = await this.processNewsAPIArticles(
        response.articles, 
        category, 
        language
      );
      
      // Filter out duplicates
      const duplicateChecks = await Promise.all(
        articles.map(async (article) => ({
          article,
          exists: await this.database.articleExists(article.url)
        }))
      );
      
      const newArticles = duplicateChecks
        .filter(check => !check.exists)
        .map(check => check.article);
      
      if (newArticles.length > 0) {
        await this.database.saveArticles(newArticles);
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
    console.log(`Fetching top ${category} headlines in ${language}...`);
    
    try {
      const response = await this.newsAPI.getTopHeadlines(category, language);
      const articles = await this.processNewsAPIArticles(
        response.articles, 
        category, 
        language
      );
      
      // Filter out duplicates
      const duplicateChecks = await Promise.all(
        articles.map(async (article) => ({
          article,
          exists: await this.database.articleExists(article.url)
        }))
      );
      
      const newArticles = duplicateChecks
        .filter(check => !check.exists)
        .map(check => check.article);
      
      if (newArticles.length > 0) {
        await this.database.saveArticles(newArticles);
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
    return await this.database.getArticles(filters);
  }

  /**
   * Select articles for newsletter
   */
  async selectArticlesForNewsletter(articleIds: string[]): Promise<void> {
    await this.database.selectArticles(articleIds);
    console.log(`Selected ${articleIds.length} articles for newsletter`);
  }

  /**
   * Unselect articles from newsletter
   */
  async unselectArticlesFromNewsletter(articleIds: string[]): Promise<void> {
    await this.database.unselectArticles(articleIds);
    console.log(`Unselected ${articleIds.length} articles from newsletter`);
  }

  /**
   * Get selected articles for newsletter generation
   */
  async getSelectedArticles(): Promise<Article[]> {
    return await this.database.getSelectedArticles();
  }

  /**
   * Clear all selections
   */
  async clearAllSelections(): Promise<void> {
    await this.database.clearSelections();
    console.log('Cleared all article selections');
  }

  /**
   * Get article statistics
   */
  async getArticleStats(): Promise<Record<Category, number>> {
    return await this.database.getArticleStats();
  }

  /**
   * Translate and re-summarize existing articles
   */
  async translateArticle(articleId: string, targetLanguage: Language): Promise<Article | null> {
    const article = await this.database.getArticleById(articleId);
    if (!article) {
      console.error(`Article not found: ${articleId}`);
      return null;
    }

    if (article.language === targetLanguage) {
      console.log(`Article is already in ${targetLanguage}`);
      return article;
    }

    try {
      console.log(`Translating article to ${targetLanguage}...`);
      
      const { summary, translatedTitle } = await this.llmService.processArticle(
        article.title,
        article.description,
        article.content,
        targetLanguage
      );

      const translatedArticle: Article = {
        ...article,
        id: randomUUID(), // New ID for translated version
        title: translatedTitle || article.title,
        summary,
        language: targetLanguage,
        createdAt: new Date()
      };

      await this.database.saveArticle(translatedArticle);
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
    const deletedCount = await this.database.cleanupOldArticles(days);
    console.log(`Cleaned up ${deletedCount} old articles`);
    return deletedCount;
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
      this.newsAPI.testConnection(),
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

  /**
   * Process NewsAPI articles into internal Article format
   */
  private async processNewsAPIArticles(
    newsArticles: NewsAPIArticle[],
    category: Category,
    language: Language
  ): Promise<Article[]> {
    const articles: Article[] = [];

    for (const newsArticle of newsArticles) {
      try {
        // Generate summary using LLM
        const { summary } = await this.llmService.processArticle(
          newsArticle.title,
          newsArticle.description,
          newsArticle.content,
          language
        );

        const article: Article = {
          id: randomUUID(),
          title: newsArticle.title,
          author: newsArticle.author,
          description: newsArticle.description,
          url: newsArticle.url,
          imageUrl: newsArticle.urlToImage,
          publishedAt: new Date(newsArticle.publishedAt),
          content: newsArticle.content,
          category,
          source: newsArticle.source.name,
          summary,
          language,
          originalLanguage: language,
          isSelected: false,
          createdAt: new Date()
        };

        articles.push(article);
      } catch (error) {
        console.warn(`Failed to process article: ${newsArticle.title}`, error);
        // Continue processing other articles
      }
    }

    return articles;
  }

  /**
   * Determine article category based on keyword (simple heuristic)
   */
  private determineCategory(keyword: string): Category {
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