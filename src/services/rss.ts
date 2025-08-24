import { randomUUID } from 'crypto';
import { RSSProvider } from '../providers/rss.js';
import { DatabaseService } from './database.js';
import { LLMService } from './llm.js';
import type {
  RSSFeed,
  Article,
  Category,
  Language,
  RSSFeedMetadata
} from '../types/index.js';

/**
 * RSS Feed management service
 */
export class RSSService {
  private rssProvider: RSSProvider;
  private database: DatabaseService;
  private llmService: LLMService;

  constructor(database: DatabaseService, llmService: LLMService) {
    this.rssProvider = new RSSProvider();
    this.database = database;
    this.llmService = llmService;
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
    // Check if feed already exists
    if (await this.database.rssFeedExists(url)) {
      throw new Error('RSS feed with this URL already exists');
    }

    // Validate and fetch feed metadata
    const validation = await this.rssProvider.validateFeedUrl(url);
    if (!validation.isValid) {
      throw new Error(`Invalid RSS feed: ${validation.error}`);
    }

    // Auto-detect category and language if not provided
    let detectedCategory = category;
    let detectedLanguage = language;

    if (!category || !language) {
      try {
        const { articles, metadata } = await this.rssProvider.fetchFeed(url);
        
        if (!detectedCategory) {
          detectedCategory = this.rssProvider.detectCategoryFromFeed(metadata, articles);
        }
        
        if (!detectedLanguage) {
          detectedLanguage = this.rssProvider.detectLanguageFromFeed(metadata, articles);
        }
      } catch (error) {
        console.warn('Could not auto-detect feed properties, using defaults');
        detectedCategory = detectedCategory || 'tech';
        detectedLanguage = detectedLanguage || 'english';
      }
    }

    const feed: RSSFeed = {
      id: randomUUID(),
      name,
      url,
      category: detectedCategory!,
      language: detectedLanguage!,
      isActive: true,
      lastFetched: null,
      createdAt: new Date(),
      description: description || validation.metadata?.description,
    };

    await this.database.saveRSSFeed(feed);
    console.log(`✅ Added RSS feed: ${name}`);
    
    return feed;
  }

  /**
   * Remove RSS feed subscription
   */
  async removeRSSFeed(feedId: string): Promise<boolean> {
    const feed = await this.database.getRSSFeedById(feedId);
    if (!feed) {
      return false;
    }

    await this.database.deleteRSSFeed(feedId);
    console.log(`✅ Removed RSS feed: ${feed.name}`);
    
    return true;
  }

  /**
   * Toggle RSS feed active status
   */
  async toggleRSSFeed(feedId: string, isActive: boolean): Promise<boolean> {
    const feed = await this.database.getRSSFeedById(feedId);
    if (!feed) {
      return false;
    }

    await this.database.toggleRSSFeedStatus(feedId, isActive);
    console.log(`✅ ${isActive ? 'Activated' : 'Deactivated'} RSS feed: ${feed.name}`);
    
    return true;
  }

  /**
   * Fetch articles from a specific RSS feed
   */
  async fetchFromRSSFeed(feedId: string): Promise<Article[]> {
    const feed = await this.database.getRSSFeedById(feedId);
    if (!feed) {
      throw new Error('RSS feed not found');
    }

    if (!feed.isActive) {
      console.log(`Skipping inactive RSS feed: ${feed.name}`);
      return [];
    }

    try {
      console.log(`Fetching articles from RSS feed: ${feed.name}`);
      
      const { articles: rssArticles } = await this.rssProvider.fetchFeed(feed.url);
      const processedArticles: Article[] = [];

      for (const rssArticle of rssArticles) {
        try {
          // Convert RSS article to our internal format
          const article = this.rssProvider.convertRSSArticleToArticle(
            rssArticle,
            feed.id,
            feed.name,
            feed.category,
            feed.language
          );

          // Skip if article already exists
          if (await this.database.articleExists(article.url)) {
            continue;
          }

          // Generate AI summary
          const { summary } = await this.llmService.processArticle(
            article.title,
            article.description,
            article.content,
            feed.language
          );

          article.summary = summary;
          processedArticles.push(article);
        } catch (error) {
          console.warn(`Failed to process RSS article: ${rssArticle.title}`, error);
        }
      }

      // Save articles to database
      if (processedArticles.length > 0) {
        await this.database.saveArticles(processedArticles);
      }

      // Update last fetched time
      await this.database.updateRSSFeedLastFetched(feed.id, new Date());

      console.log(`✅ Fetched ${processedArticles.length} new articles from ${feed.name}`);
      return processedArticles;
    } catch (error) {
      console.error(`Failed to fetch from RSS feed ${feed.name}:`, error);
      return [];
    }
  }

  /**
   * Fetch articles from all active RSS feeds
   */
  async fetchFromAllRSSFeeds(): Promise<Article[]> {
    const activeFeeds = await this.database.getRSSFeeds(true);
    if (activeFeeds.length === 0) {
      console.log('No active RSS feeds to fetch from');
      return [];
    }

    console.log(`Fetching from ${activeFeeds.length} RSS feeds...`);
    const allArticles: Article[] = [];

    // Process feeds sequentially to avoid overwhelming servers
    for (const feed of activeFeeds) {
      try {
        const articles = await this.fetchFromRSSFeed(feed.id);
        allArticles.push(...articles);
        
        // Small delay between feeds
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to fetch from feed ${feed.name}:`, error);
      }
    }

    console.log(`✅ Total articles fetched from RSS feeds: ${allArticles.length}`);
    return allArticles;
  }

  /**
   * Get all RSS feeds
   */
  async getAllRSSFeeds(): Promise<RSSFeed[]> {
    return await this.database.getRSSFeeds();
  }

  /**
   * Get RSS feeds by category
   */
  async getRSSFeedsByCategory(category: Category): Promise<RSSFeed[]> {
    return await this.database.getRSSFeedsByCategory(category);
  }

  /**
   * Get RSS feed statistics
   */
  async getRSSFeedStats() {
    return await this.database.getRSSFeedStats();
  }

  /**
   * Import common RSS feeds
   */
  async importCommonFeeds(category?: Category): Promise<number> {
    const commonFeeds = RSSProvider.getCommonRSSFeeds();
    const feedsToImport = category ? commonFeeds[category] : [
      ...commonFeeds.finance,
      ...commonFeeds.tech
    ];

    let importedCount = 0;

    for (const feedInfo of feedsToImport) {
      try {
        // Skip if already exists
        if (await this.database.rssFeedExists(feedInfo.url)) {
          console.log(`Skipping existing feed: ${feedInfo.name}`);
          continue;
        }

        await this.addRSSFeed(
          feedInfo.name,
          feedInfo.url,
          category || (commonFeeds.finance.includes(feedInfo) ? 'finance' : 'tech'),
          'english',
          feedInfo.description
        );
        
        importedCount++;
      } catch (error) {
        console.warn(`Failed to import ${feedInfo.name}:`, error);
      }
    }

    console.log(`✅ Imported ${importedCount} RSS feeds`);
    return importedCount;
  }

  /**
   * Test RSS feed connectivity
   */
  async testRSSFeed(feedId: string): Promise<{
    isWorking: boolean;
    error?: string;
    articlesCount?: number;
    metadata?: RSSFeedMetadata;
  }> {
    const feed = await this.database.getRSSFeedById(feedId);
    if (!feed) {
      return { isWorking: false, error: 'Feed not found' };
    }

    try {
      const { articles, metadata } = await this.rssProvider.fetchFeed(feed.url);
      return {
        isWorking: true,
        articlesCount: articles.length,
        metadata
      };
    } catch (error) {
      return {
        isWorking: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}