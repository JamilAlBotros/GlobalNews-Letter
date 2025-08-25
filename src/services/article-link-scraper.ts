import { GoogleRSSDatabaseManager } from '../database/google-rss-schema.js';
import type { GoogleRSSFeed, ArticleLink } from '../database/google-rss-schema.js';
import { RSSProvider } from '../providers/rss.js';
import crypto from 'crypto';

/**
 * Article Link Scraper Service
 * Scrapes article links from Google RSS feeds and stores them for processing
 */

export class ArticleLinkScraper {
  private dbManager: GoogleRSSDatabaseManager;
  private rssProvider: RSSProvider;
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(dbPath?: string) {
    this.dbManager = new GoogleRSSDatabaseManager(dbPath);
    this.rssProvider = new RSSProvider();
  }

  async initialize(): Promise<void> {
    await this.dbManager.initialize();
  }

  /**
   * Start continuous scraping of all active feeds
   */
  async startContinuousScraping(intervalMinutes: number = 30): Promise<void> {
    if (this.isRunning) {
      console.log('📡 Article scraper is already running');
      return;
    }

    console.log(`🚀 Starting continuous article scraping (every ${intervalMinutes} minutes)`);
    this.isRunning = true;

    // Initial scrape
    await this.scrapeAllFeeds();

    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.scrapeAllFeeds();
      }
    }, intervalMinutes * 60 * 1000);

    console.log('✅ Continuous scraping started');
    console.log('💡 Press Ctrl+C to stop');
  }

  /**
   * Stop continuous scraping
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('🛑 Scraper is not running');
      return;
    }

    console.log('🛑 Stopping article scraper...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('✅ Article scraper stopped');
  }

  /**
   * Scrape articles from all active feeds
   */
  async scrapeAllFeeds(): Promise<void> {
    try {
      console.log(`\n⏳ ${new Date().toLocaleString()} - Starting feed scraping cycle...`);
      
      const activeFeeds = await this.dbManager.getActiveFeeds();
      console.log(`📡 Found ${activeFeeds.length} active feeds`);

      if (activeFeeds.length === 0) {
        console.log('ℹ️  No active feeds found. Add feeds using: npm run google-rss');
        return;
      }

      let totalNewLinks = 0;
      let successCount = 0;
      let errorCount = 0;

      for (const feed of activeFeeds) {
        try {
          const newLinks = await this.scrapeFeed(feed);
          totalNewLinks += newLinks;
          successCount++;
          
          // Brief pause between feeds to be respectful
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`❌ Error scraping feed ${feed.name}: ${error instanceof Error ? error.message : error}`);
          errorCount++;
        }
      }

      console.log(`\n📊 Scraping cycle completed:`);
      console.log(`   ✅ Successful feeds: ${successCount}`);
      console.log(`   ❌ Failed feeds: ${errorCount}`);
      console.log(`   🆕 New article links: ${totalNewLinks}`);
      
      // Update daily stats
      const today = new Date().toISOString().split('T')[0];
      for (const feed of activeFeeds) {
        if (feed.id) {
          await this.dbManager.updateProcessingStats(feed.id, today, { linksScraped: 0 });
        } // Will be updated per feed
      }

    } catch (error) {
      console.error('❌ Error during scraping cycle:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Scrape articles from a specific feed
   */
  async scrapeFeed(feed: GoogleRSSFeed): Promise<number> {
    console.log(`📡 Scraping: ${feed.name} (${feed.mode})`);
    
    try {
      // Fetch RSS feed
      const { articles } = await this.rssProvider.fetchFeed(feed.url);
      console.log(`   📰 Found ${articles.length} articles in RSS`);

      if (articles.length === 0) {
        return 0;
      }

      // Convert RSS articles to ArticleLink format
      const articleLinks: Omit<ArticleLink, 'scrapedAt'>[] = articles.map(article => {
        const linkId = this.generateLinkId(feed.id!, article.link);
        
        return {
          id: linkId,
          feedId: feed.id!,
          title: article.title || 'Untitled',
          link: article.link,
          pubDate: article.pubDate || new Date().toISOString(),
          guid: article.guid || '',
          description: article.contentSnippet || article.content || '',
          processed: false,
          processingStage: 'pending'
        };
      });

      // Save to database (will ignore duplicates)
      const newLinksCount = await this.dbManager.saveArticleLinks(articleLinks);
      console.log(`   ✅ Saved ${newLinksCount} new article links`);

      // Update feed last scraped time and article count
      if (feed.id) {
        await this.dbManager.updateFeedLastScraped(feed.id, articles.length);

        // Update daily stats
        const today = new Date().toISOString().split('T')[0];
        await this.dbManager.updateProcessingStats(feed.id, today, {
          linksScraped: newLinksCount
        });
      }

      return newLinksCount;

    } catch (error) {
      console.error(`   ❌ Failed to scrape feed: ${error instanceof Error ? error.message : error}`);
      throw error;
    }
  }

  /**
   * Scrape a specific feed by ID
   */
  async scrapeFeedById(feedId: string): Promise<number> {
    const feed = await this.dbManager.getFeed(feedId);
    
    if (!feed) {
      throw new Error(`Feed not found: ${feedId}`);
    }

    if (!feed.isActive) {
      throw new Error(`Feed is not active: ${feed.name}`);
    }

    return this.scrapeFeed(feed);
  }

  /**
   * Get scraping statistics
   */
  async getScrapingStats(): Promise<any> {
    const summary = await this.dbManager.getFeedProcessingSummary();
    const dailyOverview = await this.dbManager.getDailyProcessingOverview(7); // Last 7 days
    
    return {
      feedSummary: summary,
      weeklyOverview: dailyOverview,
      isRunning: this.isRunning
    };
  }

  /**
   * Get pending article links for processing
   */
  async getPendingArticles(limit: number = 50): Promise<ArticleLink[]> {
    return this.dbManager.getPendingLinks(limit);
  }

  /**
   * Update processing stage for an article link
   */
  async updateArticleProcessingStage(
    linkId: string, 
    stage: ArticleLink['processingStage'], 
    errorMessage?: string
  ): Promise<void> {
    return this.dbManager.updateLinkProcessingStage(linkId, stage, errorMessage);
  }

  /**
   * Clean up old processed links (keep only recent ones)
   */
  async cleanupOldLinks(daysToKeep: number = 30): Promise<number> {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffIso = cutoffDate.toISOString();

      this.dbManager['db'].run(
        'DELETE FROM article_links WHERE scrapedAt < ? AND processed = 1',
        [cutoffIso],
        function(err) {
          if (err) {
            reject(err);
          } else {
            console.log(`🗑️ Cleaned up ${this.changes} old processed article links`);
            resolve(this.changes);
          }
        }
      );
    });
  }

  /**
   * Validate and reactivate feeds
   */
  async validateFeeds(): Promise<void> {
    console.log('🔍 Validating all feeds...');
    const allFeeds = await this.dbManager.getActiveFeeds();
    
    for (const feed of allFeeds) {
      try {
        const validation = await this.rssProvider.validateFeedUrl(feed.url);
        
        if (!validation.isValid) {
          console.log(`❌ Feed validation failed: ${feed.name} - ${validation.error}`);
          // Could mark feed as inactive or log the issue
        } else {
          console.log(`✅ Feed valid: ${feed.name}`);
          await this.dbManager.validateFeed(feed.id);
        }
      } catch (error) {
        console.error(`❌ Error validating feed ${feed.name}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  /**
   * Generate unique link ID based on feed and article URL
   */
  private generateLinkId(feedId: string, articleUrl: string): string {
    const input = `${feedId}-${articleUrl}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    this.stop();
    await this.dbManager.close();
  }
}