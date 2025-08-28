import RSSParser from 'rss-parser';
import { rssConfig, env } from '../config/environment.js';
import { EnhancedDatabaseService } from './enhanced-database.js';
import { LLMService } from './llm-service.js';
import { ErrorHandler, TimeoutError, ExternalServiceError, DatabaseError } from '../utils/errors.js';
import type { SupportedLanguage } from './llm-service.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * RSS Feed Processing Engine
 * Handles feed fetching, parsing, and article processing
 */

export interface FeedItem {
  title: string;
  link: string;
  description?: string;
  content?: string;
  author?: string;
  pubDate?: string;
  guid?: string;
  categories?: string[];
  enclosure?: {
    url: string;
    type?: string;
    length?: string;
  };
}

export interface ProcessedFeed {
  feedUrl: string;
  title?: string;
  description?: string;
  items: FeedItem[];
  lastBuildDate?: string;
  language?: string;
  fetchedAt: Date;
  processingTimeMs: number;
}

export interface ProcessingResult {
  feedInstanceId: string;
  processed: number;
  successful: number;
  failed: number;
  newArticles: number;
  errors: string[];
  processingTimeMs: number;
}

export interface FeedProcessingOptions {
  maxItems?: number;
  skipDuplicates?: boolean;
  autoTranslate?: boolean;
  urgencyLevel?: 'low' | 'medium' | 'high' | 'breaking';
}

export class RSSProcessor {
  private parser: RSSParser;
  private db: EnhancedDatabaseService;
  private llmService: LLMService;
  
  constructor(db: EnhancedDatabaseService, llmService: LLMService) {
    this.db = db;
    this.llmService = llmService;
    
    this.parser = new RSSParser({
      timeout: rssConfig.timeoutMs,
      headers: {
        'User-Agent': rssConfig.userAgent
      },
      customFields: {
        item: [
          ['content:encoded', 'contentEncoded'],
          ['dc:creator', 'creator'],
          ['media:content', 'mediaContent', { keepArray: true }],
          ['category', 'categories', { keepArray: true }]
        ]
      }
    });
  }

  /**
   * Fetch and parse RSS feed
   */
  async fetchFeed(url: string): Promise<ProcessedFeed> {
    const startTime = Date.now();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), rssConfig.timeoutMs);

      const feed = await this.parser.parseURL(url);
      clearTimeout(timeoutId);

      return {
        feedUrl: url,
        title: feed.title,
        description: feed.description,
        items: feed.items.map(item => this.parseItem(item)),
        lastBuildDate: feed.lastBuildDate,
        language: feed.language,
        fetchedAt: new Date(),
        processingTimeMs: Date.now() - startTime
      };
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new TimeoutError('RSS fetch', rssConfig.timeoutMs);
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        throw new ExternalServiceError('RSS feed', 'Feed unavailable', 503);
      }
      
      throw new ExternalServiceError('RSS feed', error.message || 'Failed to fetch feed');
    }
  }

  /**
   * Process a single feed instance
   */
  async processFeedInstance(
    feedInstanceId: string, 
    options: FeedProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const result: ProcessingResult = {
      feedInstanceId,
      processed: 0,
      successful: 0,
      failed: 0,
      newArticles: 0,
      errors: [],
      processingTimeMs: 0
    };

    try {
      // Get feed instance details
      const feedInstance = await this.db.getFeedInstance(feedInstanceId);
      if (!feedInstance) {
        throw new Error('Feed instance not found');
      }

      // Fetch the RSS feed
      const processedFeed = await this.fetchFeed(feedInstance.feed_url);
      
      // Update feed instance health
      await this.db.updateFeedInstanceHealth(feedInstanceId, {
        lastFetched: new Date().toISOString(),
        lastSuccess: new Date().toISOString(),
        consecutiveFailures: 0,
        avgArticlesPerFetch: processedFeed.items.length,
        reliabilityScore: Math.min(1.0, (feedInstance.reliability_score + 0.1))
      });

      // Process each item
      const maxItems = options.maxItems || processedFeed.items.length;
      const itemsToProcess = processedFeed.items.slice(0, maxItems);
      
      for (const item of itemsToProcess) {
        try {
          result.processed++;
          
          const wasNew = await this.processArticle(item, feedInstance, options);
          if (wasNew) {
            result.newArticles++;
          }
          result.successful++;
          
        } catch (error) {
          result.failed++;
          result.errors.push(`Item "${item.title}": ${error instanceof Error ? error.message : 'Unknown error'}`);
          ErrorHandler.logError(error as Error, { 
            feedInstanceId, 
            itemTitle: item.title,
            itemLink: item.link 
          });
        }
      }

      result.processingTimeMs = Date.now() - startTime;
      return result;

    } catch (error) {
      // Update failure metrics
      try {
        await this.db.updateFeedInstanceHealth(feedInstanceId, {
          lastFetched: new Date().toISOString(),
          consecutiveFailures: (await this.db.getFeedInstance(feedInstanceId))?.consecutive_failures + 1 || 1,
          reliabilityScore: Math.max(0.1, (await this.db.getFeedInstance(feedInstanceId))?.reliability_score - 0.1 || 0.9)
        });
      } catch (dbError) {
        ErrorHandler.logError(dbError as Error, { operation: 'updateFeedInstanceHealth', feedInstanceId });
      }

      result.errors.push(error instanceof Error ? error.message : 'Unknown processing error');
      result.processingTimeMs = Date.now() - startTime;
      
      throw error;
    }
  }

  /**
   * Process multiple feed instances by tier
   */
  async processFeedsByTier(
    tier: 'realtime' | 'frequent' | 'standard' | 'slow',
    maxConcurrent: number = 3
  ): Promise<{
    processed: number;
    successful: number;
    totalArticles: number;
    totalNewArticles: number;
    errors: string[];
  }> {
    const feedInstances = await this.db.getFeedInstancesForRefresh(tier);
    const summary = {
      processed: 0,
      successful: 0,
      totalArticles: 0,
      totalNewArticles: 0,
      errors: [] as string[]
    };

    // Process feeds in batches to control concurrency
    for (let i = 0; i < feedInstances.length; i += maxConcurrent) {
      const batch = feedInstances.slice(i, i + maxConcurrent);
      const batchPromises = batch.map(async (instance) => {
        try {
          const result = await this.processFeedInstance(instance.id);
          return result;
        } catch (error) {
          return {
            feedInstanceId: instance.id,
            processed: 0,
            successful: 0,
            failed: 1,
            newArticles: 0,
            errors: [error instanceof Error ? error.message : 'Unknown error'],
            processingTimeMs: 0
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const res = result.value;
          summary.processed++;
          if (res.successful > 0) summary.successful++;
          summary.totalArticles += res.successful;
          summary.totalNewArticles += res.newArticles;
          summary.errors.push(...res.errors);
        } else {
          summary.errors.push(result.reason?.message || 'Batch processing error');
        }
      });

      // Small delay between batches
      if (i + maxConcurrent < feedInstances.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return summary;
  }

  /**
   * Process individual article from feed item
   */
  private async processArticle(
    item: FeedItem, 
    feedInstance: any, 
    options: FeedProcessingOptions
  ): Promise<boolean> {
    // Check for duplicates by URL or GUID
    const existingByUrl = await this.checkDuplicateByUrl(item.link);
    const existingByGuid = item.guid ? await this.checkDuplicateByGuid(item.guid) : null;
    
    if (options.skipDuplicates !== false && (existingByUrl || existingByGuid)) {
      return false; // Not new
    }

    // Detect language if not specified
    const detectedLang = await this.detectArticleLanguage(item);
    
    // Determine content quality and urgency
    const contentAnalysis = await this.analyzeContent(item);
    
    // Create article record
    const articleId = uuidv4();
    const article = {
      id: articleId,
      feed_instance_id: feedInstance.id,
      title: item.title || 'Untitled',
      description: item.description,
      content: item.content || item.contentEncoded,
      summary: contentAnalysis.summary,
      author: item.author || item.creator,
      source_url: item.link,
      image_url: this.extractImageUrl(item),
      published_at: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
      scraped_at: new Date().toISOString(),
      detected_language: detectedLang,
      language_confidence: 0.9,
      content_category: feedInstance.content_category || 'general',
      content_tags: this.extractTags(item),
      urgency_level: options.urgencyLevel || contentAnalysis.urgency,
      content_quality: contentAnalysis.quality,
      word_count: this.countWords(item.content || item.description || ''),
      readability_score: contentAnalysis.readabilityScore,
      processing_stage: 'processed',
      is_selected: false
    };

    await this.db.saveArticleOriginal(article);
    
    // Auto-translate if enabled
    if (options.autoTranslate && detectedLang !== 'en') {
      await this.queueForTranslation(articleId, detectedLang);
    }
    
    return true; // New article
  }

  /**
   * Parse RSS item with error handling
   */
  private parseItem(item: any): FeedItem {
    return {
      title: item.title || 'Untitled',
      link: item.link || item.guid || '',
      description: item.description || item.summary,
      content: item.content || item['content:encoded'] || item.contentEncoded,
      author: item.author || item.creator || item['dc:creator'],
      pubDate: item.pubDate || item.isoDate,
      guid: item.guid || item.id,
      categories: Array.isArray(item.categories) ? item.categories : 
                  item.category ? [item.category] : [],
      enclosure: item.enclosure
    };
  }

  /**
   * Detect article language using LLM
   */
  private async detectArticleLanguage(item: FeedItem): Promise<SupportedLanguage> {
    const textSample = [item.title, item.description].filter(Boolean).join(' ').slice(0, 500);
    
    try {
      const detection = await this.llmService.detectLanguage(textSample);
      return detection.language;
    } catch (error) {
      // Fallback to simple detection
      return this.simpleLanguageDetection(textSample);
    }
  }

  /**
   * Analyze content for quality and urgency
   */
  private async analyzeContent(item: FeedItem): Promise<{
    quality: 'high' | 'medium' | 'low';
    urgency: 'low' | 'medium' | 'high' | 'breaking';
    summary?: string;
    readabilityScore: number;
  }> {
    const text = item.content || item.description || item.title;
    const wordCount = this.countWords(text);
    
    // Basic quality assessment
    let quality: 'high' | 'medium' | 'low' = 'medium';
    if (wordCount > 500 && item.content && item.author) {
      quality = 'high';
    } else if (wordCount < 100 || !item.description) {
      quality = 'low';
    }

    // Basic urgency detection
    let urgency: 'low' | 'medium' | 'high' | 'breaking' = 'medium';
    const urgentWords = /\b(breaking|urgent|alert|crisis|emergency|immediate|developing)\b/i;
    const titleText = (item.title || '').toLowerCase();
    
    if (urgentWords.test(titleText)) {
      urgency = titleText.includes('breaking') ? 'breaking' : 'high';
    } else if (item.pubDate && new Date().getTime() - new Date(item.pubDate).getTime() < 3600000) {
      urgency = 'high'; // Published within last hour
    }

    // Generate summary for high-quality articles
    let summary: string | undefined;
    if (quality === 'high' && text.length > 300) {
      try {
        const summaryResponse = await this.llmService.summarizeText({
          text,
          language: 'en',
          maxLength: 200,
          style: 'brief'
        });
        summary = summaryResponse.summary;
      } catch (error) {
        // Fallback to truncated description
        summary = text.slice(0, 200) + '...';
      }
    }

    return {
      quality,
      urgency,
      summary,
      readabilityScore: this.calculateReadabilityScore(text)
    };
  }

  /**
   * Queue article for translation
   */
  private async queueForTranslation(articleId: string, sourceLanguage: SupportedLanguage): Promise<void> {
    const targetLanguages: SupportedLanguage[] = ['en']; // Always translate to English
    
    // Add other target languages based on source
    if (sourceLanguage !== 'es') targetLanguages.push('es');
    if (sourceLanguage !== 'pt') targetLanguages.push('pt');
    
    // Create translation jobs
    for (const targetLang of targetLanguages) {
      const jobId = uuidv4();
      await this.db.createTranslationJob({
        id: jobId,
        original_article_id: articleId,
        target_language: targetLang,
        priority: 'normal',
        job_status: 'queued',
        retry_count: 0
      });
    }
  }

  /**
   * Helper methods
   */
  private async checkDuplicateByUrl(url: string): Promise<boolean> {
    try {
      // Simple check - in production would use proper query
      return false; // Simplified for now
    } catch (error) {
      return false;
    }
  }

  private async checkDuplicateByGuid(guid: string): Promise<boolean> {
    try {
      return false; // Simplified for now
    } catch (error) {
      return false;
    }
  }

  private extractImageUrl(item: FeedItem): string | undefined {
    if (item.enclosure?.type?.startsWith('image/')) {
      return item.enclosure.url;
    }
    
    // Look for images in content
    const content = item.content || item.description || '';
    const imgMatch = content.match(/<img[^>]+src=['"]([^'"]+)['"][^>]*>/i);
    return imgMatch?.[1];
  }

  private extractTags(item: FeedItem): string {
    const tags = item.categories || [];
    return JSON.stringify(tags);
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private calculateReadabilityScore(text: string): number {
    // Simple Flesch Reading Ease approximation
    const sentences = text.split(/[.!?]+/).length;
    const words = this.countWords(text);
    const syllables = text.length / 4; // Very rough approximation
    
    if (words === 0 || sentences === 0) return 0.5;
    
    const score = 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
    return Math.max(0, Math.min(1, score / 100));
  }

  private simpleLanguageDetection(text: string): SupportedLanguage {
    const sample = text.toLowerCase().slice(0, 200);
    
    if (/\b(the|and|that|have|for|not|with|you|this|but|his|from|they)\b/.test(sample)) return 'en';
    if (/\b(el|la|de|que|y|es|en|un|se|no|te|lo|le|da|su|por|son|con|para|una|esta|muy)\b/.test(sample)) return 'es';
    if (/\b(de|que|não|uma|com|para|por|mais|como|mas|foi|ele|ela|seu|sua|isso)\b/.test(sample)) return 'pt';
    if (/\b(le|de|et|à|un|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas|tout|mais)\b/.test(sample)) return 'fr';
    if (/[\u4e00-\u9fff]/.test(sample)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return 'ja';
    if (/[\u0600-\u06ff]/.test(sample)) return 'ar';
    
    return 'en';
  }

  /**
   * Health check for RSS processor
   */
  async healthCheck(): Promise<{ 
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics?: {
      totalFeeds: number;
      activeFeeds: number;
      avgProcessingTime: number;
      successRate: number;
    };
  }> {
    console.log('[RSSProcessor] Performing health check...');
    
    try {
      // Basic health metrics
      const feedSources = await this.db.getFeedSources({ activeOnly: true });
      const totalFeeds = feedSources.length;
      const activeFeeds = feedSources.filter(f => f.is_active).length;
      
      console.log(`[RSSProcessor] Health check completed: ${totalFeeds} total feeds, ${activeFeeds} active`);
      
      return {
        status: 'healthy',
        metrics: {
          totalFeeds,
          activeFeeds,
          avgProcessingTime: 2000, // Mock for now
          successRate: 0.95 // Mock for now
        }
      };
    } catch (error) {
      console.error(`[RSSProcessor] Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { status: 'unhealthy' };
    }
  }
}