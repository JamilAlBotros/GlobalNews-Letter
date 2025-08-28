import { EnhancedDatabaseService } from './enhanced-database.js';
import { LanguageDetectionService } from './language-detection.js';
import { 
  FeedInstance, 
  FeedSource, 
  ArticleOriginal, 
  RefreshTier, 
  LanguageCode 
} from '../api/schemas/enhanced-schemas.js';
import { RSSService } from './rss.js';
import Parser from 'rss-parser';

/**
 * Feed Management Service with Adaptive Refresh Logic
 * Handles tiered refresh rates, feed health monitoring, and language-optimized processing
 */

interface RefreshStrategy {
  base_minutes: number;
  max_minutes: number;
  categories: string[];
  urgency_levels: string[];
  language_multiplier: Record<LanguageCode, number>;
}

interface FeedHealthScore {
  reliability: number;      // 0-1 based on success rate
  content_quality: number;  // 0-1 based on article quality
  freshness: number;        // 0-1 based on new articles per fetch
  response_time: number;    // 0-1 based on response speed
  overall: number;          // weighted average
}

export class FeedManager {
  private db: EnhancedDatabaseService;
  private languageDetection: LanguageDetectionService;
  private rssService: RSSService;
  private parser: Parser;

  // Refresh strategies by tier
  private readonly REFRESH_STRATEGIES: Record<RefreshTier, RefreshStrategy> = {
    realtime: {
      base_minutes: 5,
      max_minutes: 15,
      categories: ['finance', 'tech'],
      urgency_levels: ['breaking', 'high'],
      language_multiplier: {
        'en': 1.0,
        'es': 1.1,
        'pt': 1.2,
        'fr': 1.2,
        'ar': 1.3,
        'zh': 1.4,
        'ja': 1.4
      }
    },
    frequent: {
      base_minutes: 30,
      max_minutes: 120,
      categories: ['finance', 'tech', 'health'],
      urgency_levels: ['high', 'normal'],
      language_multiplier: {
        'en': 1.0,
        'es': 1.1,
        'pt': 1.15,
        'fr': 1.15,
        'ar': 1.2,
        'zh': 1.25,
        'ja': 1.25
      }
    },
    standard: {
      base_minutes: 60,
      max_minutes: 360,
      categories: ['general', 'health'],
      urgency_levels: ['normal'],
      language_multiplier: {
        'en': 1.0,
        'es': 1.05,
        'pt': 1.1,
        'fr': 1.1,
        'ar': 1.15,
        'zh': 1.2,
        'ja': 1.2
      }
    },
    slow: {
      base_minutes: 240,
      max_minutes: 1440,
      categories: ['analysis'],
      urgency_levels: ['low'],
      language_multiplier: {
        'en': 1.0,
        'es': 1.0,
        'pt': 1.05,
        'fr': 1.05,
        'ar': 1.1,
        'zh': 1.15,
        'ja': 1.15
      }
    }
  };

  // Language processing complexity scores
  private readonly LANGUAGE_COMPLEXITY: Record<LanguageCode, number> = {
    'en': 0.8,  // Lowest complexity - best ML model support
    'es': 0.85,
    'pt': 0.9,
    'fr': 0.9,
    'ar': 0.95, // Higher complexity - RTL, fewer models
    'zh': 1.0,  // Highest complexity - tokenization challenges
    'ja': 1.0
  };

  constructor(
    databaseService: EnhancedDatabaseService,
    languageDetection: LanguageDetectionService,
    rssService: RSSService
  ) {
    this.db = databaseService;
    this.languageDetection = languageDetection;
    this.rssService = rssService;
    this.parser = new Parser({
      customFields: {
        feed: ['language', 'generator'],
        item: ['content:encoded', 'media:content']
      }
    });
  }

  /**
   * Get feeds that need refreshing based on their tier and adaptive logic
   */
  async getFeedsForRefresh(tier: RefreshTier, limit: number = 20): Promise<FeedInstance[]> {
    const feeds = await this.db.getFeedInstancesForRefresh(tier);
    const strategy = this.REFRESH_STRATEGIES[tier];
    
    // Filter feeds based on adaptive timing
    const readyFeeds: FeedInstance[] = [];
    
    for (const feed of feeds) {
      const source = await this.db.getFeedSource(feed.source_id);
      if (!source || !source.is_active) continue;

      const adaptiveInterval = await this.calculateAdaptiveRefreshInterval(feed, source, strategy);
      const nextRefreshTime = this.getNextRefreshTime(feed.last_fetched, adaptiveInterval);
      
      if (new Date() >= nextRefreshTime) {
        readyFeeds.push(feed);
      }
      
      if (readyFeeds.length >= limit) break;
    }

    // Sort by priority: reliability score (desc), last fetched (asc)
    return readyFeeds.sort((a, b) => {
      const reliabilityDiff = b.reliability_score - a.reliability_score;
      if (Math.abs(reliabilityDiff) > 0.1) return reliabilityDiff;
      
      const aLastFetched = new Date(a.last_fetched || 0);
      const bLastFetched = new Date(b.last_fetched || 0);
      return aLastFetched.getTime() - bLastFetched.getTime();
    });
  }

  /**
   * Process a feed instance - fetch, parse, and store articles
   */
  async processFeedInstance(feedInstance: FeedInstance): Promise<{
    success: boolean;
    articlesFound: number;
    articlesNew: number;
    processingTime: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let articlesFound = 0;
    let articlesNew = 0;
    let error: string | undefined;

    try {
      // Update feed status to indicate processing has started
      await this.db.updateFeedInstanceHealth(feedInstance.id, {
        lastFetched: new Date().toISOString()
      });

      // Fetch and parse RSS feed
      const feedData = await this.parser.parseURL(feedInstance.feed_url);
      articlesFound = feedData.items.length;

      // Get feed source for language and category information
      const source = await this.db.getFeedSource(feedInstance.source_id);
      if (!source) {
        throw new Error(`Feed source not found: ${feedInstance.source_id}`);
      }

      // Process each article
      for (const item of feedData.items.slice(0, 50)) { // Limit to prevent overload
        try {
          const existingArticle = await this.checkArticleExists(item.link || item.guid || '');
          if (existingArticle) continue;

          const article = await this.createArticleFromRSSItem(item, feedInstance, source);
          if (article) {
            await this.db.saveArticleOriginal(article);
            articlesNew++;
          }
        } catch (articleError) {
          console.error(`Error processing article from ${feedInstance.feed_url}:`, articleError);
        }
      }

      // Update feed health and reliability metrics
      const processingTime = Date.now() - startTime;
      await this.updateFeedHealth(feedInstance, {
        success: true,
        articlesFound,
        articlesNew,
        processingTime
      });

      return {
        success: true,
        articlesFound,
        articlesNew,
        processingTime
      };

    } catch (fetchError) {
      error = fetchError instanceof Error ? fetchError.message : 'Unknown error';
      console.error(`Error processing feed ${feedInstance.feed_url}:`, fetchError);

      const processingTime = Date.now() - startTime;
      await this.updateFeedHealth(feedInstance, {
        success: false,
        articlesFound: 0,
        articlesNew: 0,
        processingTime,
        error
      });

      return {
        success: false,
        articlesFound: 0,
        articlesNew: 0,
        processingTime,
        error
      };
    }
  }

  /**
   * Create an ArticleOriginal from RSS item with language detection
   */
  private async createArticleFromRSSItem(
    item: any, 
    feedInstance: FeedInstance, 
    source: FeedSource
  ): Promise<ArticleOriginal | null> {
    if (!item.link && !item.guid) return null;

    // Extract content for language detection
    const title = item.title || '';
    const description = item.contentSnippet || item.summary || '';
    const content = item['content:encoded'] || item.content || '';
    
    // Detect language
    const languageResult = await this.languageDetection.detectLanguageFromContent(
      { title, description, link: item.link },
      [{ title, contentSnippet: description, content }]
    );

    const detectedLanguage = languageResult?.language || source.source_language;
    const languageConfidence = languageResult?.confidence || 0.5;

    // Calculate content quality
    const wordCount = this.calculateWordCount(title + ' ' + description + ' ' + content);
    const contentQuality = this.assessContentQuality(title, description, content, wordCount);

    // Determine urgency level based on keywords and recency
    const urgencyLevel = this.determineUrgencyLevel(
      title + ' ' + description,
      new Date(item.pubDate || Date.now()),
      source.content_type
    );

    const articleId = this.generateArticleId(item.link || item.guid || '');
    
    return {
      id: articleId,
      feed_instance_id: feedInstance.id,
      title,
      description: description || undefined,
      content: content || undefined,
      summary: undefined, // Will be generated later
      author: item.creator || item['dc:creator'] || undefined,
      source_url: item.link || item.guid || '',
      image_url: this.extractImageUrl(item),
      published_at: new Date(item.pubDate || Date.now()).toISOString(),
      scraped_at: new Date().toISOString(),
      detected_language: detectedLanguage as LanguageCode,
      language_confidence: languageConfidence,
      content_category: source.content_category,
      content_tags: undefined, // Will be generated later
      urgency_level: urgencyLevel,
      content_quality: contentQuality,
      word_count: wordCount,
      readability_score: undefined, // Can be calculated later
      processing_stage: 'pending',
      is_selected: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  /**
   * Calculate adaptive refresh interval based on feed performance and language complexity
   */
  private async calculateAdaptiveRefreshInterval(
    feed: FeedInstance, 
    source: FeedSource, 
    strategy: RefreshStrategy
  ): Promise<number> {
    // Start with base interval
    let interval = feed.base_refresh_minutes;

    // Apply language complexity multiplier
    const languageMultiplier = strategy.language_multiplier[source.source_language] || 1.0;
    interval *= languageMultiplier;

    if (feed.adaptive_refresh) {
      // Get feed health metrics from last 7 days
      const healthSummary = await this.db.getFeedHealthSummary(feed.id, 7);
      const healthScore = this.calculateFeedHealthScore(feed, healthSummary);

      // Adjust based on health score
      if (healthScore.overall > 0.8) {
        // High-performing feed - can refresh more frequently
        interval *= 0.8;
      } else if (healthScore.overall < 0.4) {
        // Poor-performing feed - reduce frequency
        interval *= 1.5;
      }

      // Adjust based on content freshness
      if (healthScore.freshness > 0.8) {
        // Feed provides lots of new content
        interval *= 0.9;
      } else if (healthScore.freshness < 0.2) {
        // Feed rarely has new content
        interval *= 1.3;
      }

      // Adjust based on consecutive failures
      if (feed.consecutive_failures > 0) {
        interval *= Math.min(1 + (feed.consecutive_failures * 0.2), 2.0);
      }
    }

    // Apply strategy constraints
    return Math.max(strategy.base_minutes, Math.min(interval, strategy.max_minutes));
  }

  /**
   * Calculate comprehensive feed health score
   */
  private calculateFeedHealthScore(feed: FeedInstance, healthSummary: any): FeedHealthScore {
    const reliability = feed.reliability_score;
    
    const contentQuality = healthSummary?.avg_language_confidence || 0.5;
    
    const freshness = Math.min(
      (healthSummary?.total_new_articles || 0) / Math.max(feed.avg_articles_per_fetch, 1),
      1.0
    );
    
    const responseTime = healthSummary?.avg_response_time 
      ? Math.max(0, 1 - (healthSummary.avg_response_time / 5000)) // Normalize against 5s baseline
      : 0.5;

    const overall = (
      reliability * 0.4 +
      contentQuality * 0.3 +
      freshness * 0.2 +
      responseTime * 0.1
    );

    return {
      reliability,
      content_quality: contentQuality,
      freshness,
      response_time: responseTime,
      overall
    };
  }

  /**
   * Update feed health metrics after processing
   */
  private async updateFeedHealth(
    feed: FeedInstance,
    result: {
      success: boolean;
      articlesFound: number;
      articlesNew: number;
      processingTime: number;
      error?: string;
    }
  ): Promise<void> {
    // Update feed instance health metrics
    const updates: any = {
      lastFetched: new Date().toISOString()
    };

    if (result.success) {
      updates.lastSuccess = new Date().toISOString();
      updates.consecutiveFailures = 0;
      updates.avgArticlesPerFetch = this.calculateMovingAverage(
        feed.avg_articles_per_fetch,
        result.articlesNew,
        0.2 // 20% weight for new value
      );
      
      // Improve reliability score slightly on success
      updates.reliabilityScore = Math.min(feed.reliability_score + 0.05, 1.0);
    } else {
      updates.consecutiveFailures = feed.consecutive_failures + 1;
      
      // Decrease reliability score on failure
      updates.reliabilityScore = Math.max(feed.reliability_score - 0.1, 0.0);
    }

    await this.db.updateFeedInstanceHealth(feed.id, updates);

    // Record health metric
    await this.db.recordFeedHealthMetric({
      feed_instance_id: feed.id,
      check_timestamp: new Date().toISOString(),
      response_time_ms: result.processingTime,
      articles_found: result.articlesFound,
      articles_new: result.articlesNew,
      articles_duplicates: result.articlesFound - result.articlesNew,
      is_available: result.success,
      http_status: result.success ? 200 : 500,
      error_type: result.error ? 'fetch_error' : undefined,
      error_message: result.error,
      created_at: new Date().toISOString()
    });
  }

  /**
   * Batch process feeds by tier with concurrency control
   */
  async processFeedsByTier(tier: RefreshTier, concurrency: number = 5): Promise<{
    processed: number;
    successful: number;
    totalArticles: number;
    totalNewArticles: number;
  }> {
    const feeds = await this.getFeedsForRefresh(tier, concurrency * 2);
    let processed = 0;
    let successful = 0;
    let totalArticles = 0;
    let totalNewArticles = 0;

    // Process feeds in batches with concurrency control
    for (let i = 0; i < feeds.length; i += concurrency) {
      const batch = feeds.slice(i, i + concurrency);
      const batchPromises = batch.map(feed => this.processFeedInstance(feed));
      
      const results = await Promise.allSettled(batchPromises);
      
      results.forEach((result, index) => {
        processed++;
        if (result.status === 'fulfilled' && result.value.success) {
          successful++;
          totalArticles += result.value.articlesFound;
          totalNewArticles += result.value.articlesNew;
        }
      });
    }

    return {
      processed,
      successful,
      totalArticles,
      totalNewArticles
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private getNextRefreshTime(lastFetched: string | undefined, intervalMinutes: number): Date {
    const lastFetch = new Date(lastFetched || 0);
    return new Date(lastFetch.getTime() + (intervalMinutes * 60 * 1000));
  }

  private async checkArticleExists(url: string): Promise<boolean> {
    // Simple URL existence check - could be expanded to check by content hash
    return false; // Simplified for now
  }

  private generateArticleId(url: string): string {
    // Generate deterministic ID from URL
    const hash = Buffer.from(url).toString('base64').replace(/[+/=]/g, '');
    return hash.substring(0, 32);
  }

  private extractImageUrl(item: any): string | undefined {
    if (item.enclosure?.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    
    if (item['media:content']?.url) {
      return item['media:content'].url;
    }
    
    // Look for image URLs in content
    const content = item.content || item['content:encoded'] || '';
    const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
    return imgMatch ? imgMatch[1] : undefined;
  }

  private calculateWordCount(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }

  private assessContentQuality(title: string, description: string, content: string, wordCount: number): 'high' | 'medium' | 'low' | 'failed' {
    if (!title || title.length < 10) return 'failed';
    if (wordCount < 50) return 'low';
    if (wordCount < 200) return 'medium';
    if (description && content && wordCount > 500) return 'high';
    return 'medium';
  }

  private determineUrgencyLevel(
    text: string, 
    publishedAt: Date, 
    contentType: string
  ): 'breaking' | 'high' | 'normal' | 'low' {
    const breakingKeywords = ['breaking', 'urgent', 'alert', 'emergency', 'crisis', 'flash'];
    const highUrgencyKeywords = ['market', 'crash', 'surge', 'soar', 'plunge', 'acquisition', 'merger'];
    
    const lowerText = text.toLowerCase();
    const hoursAgo = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);

    if (breakingKeywords.some(keyword => lowerText.includes(keyword))) {
      return 'breaking';
    }
    
    if (contentType === 'breaking' && hoursAgo < 2) {
      return 'breaking';
    }
    
    if (highUrgencyKeywords.some(keyword => lowerText.includes(keyword)) && hoursAgo < 6) {
      return 'high';
    }
    
    if (contentType === 'analysis') {
      return 'low';
    }
    
    return 'normal';
  }

  private calculateMovingAverage(currentAvg: number, newValue: number, weight: number): number {
    return currentAvg * (1 - weight) + newValue * weight;
  }
}