import { FastifyInstance } from "fastify";
import { 
  PollingStatus, 
  StartPollingInput, 
  UpdatePollingIntervalInput,
  PollTriggerResponse,
  ActiveFeedsStatusResponse,
  ActiveFeedStatus,
  PollingStatusType,
  PollTriggerResponseType,
  ActiveFeedsStatusResponseType,
  ActiveFeedStatusType
} from "../schemas/polling.js";
import { getDatabase } from "../database/connection.js";
import { LLMService } from "../services/llm.js";
import { ErrorHandler } from "../utils/errors.js";
import { articleRepository, feedRepository } from "../repositories/index.js";
import type { DatabaseArticle, DatabaseRSSFeed, Language, Category } from "../types/index.js";

// Global polling state
let pollingState = {
  isRunning: false,
  intervalMinutes: 60,
  lastPollTime: null as string | null,
  totalPolls: 0,
  successfulPolls: 0,
  failedPolls: 0,
  timer: null as NodeJS.Timeout | null
};

export async function pollingRoutes(app: FastifyInstance): Promise<void> {
  const db = getDatabase();
  const llmService = new LLMService();

  // Get current polling status
  app.get("/polling/status", async (request, reply) => {
    const feedStats = feedRepository.getStatistics();
    const activeFeedsCount = feedStats.active;

    const nextPollTime = pollingState.isRunning && pollingState.lastPollTime
      ? new Date(new Date(pollingState.lastPollTime).getTime() + pollingState.intervalMinutes * 60 * 1000).toISOString()
      : null;

    const status: PollingStatusType = {
      is_running: pollingState.isRunning,
      interval_minutes: pollingState.intervalMinutes,
      last_poll_time: pollingState.lastPollTime,
      next_poll_time: nextPollTime,
      total_polls: pollingState.totalPolls,
      successful_polls: pollingState.successfulPolls,
      failed_polls: pollingState.failedPolls,
      active_feeds_count: activeFeedsCount
    };

    return reply.send(status);
  });

  // Start polling
  app.post("/polling/start", async (request, reply) => {
    const body = StartPollingInput.parse(request.body);
    
    if (pollingState.isRunning) {
      throw Object.assign(new Error("Polling is already running"), {
        status: 409,
        detail: "Stop polling first before starting again"
      });
    }

    if (body.interval_minutes) {
      pollingState.intervalMinutes = body.interval_minutes;
    }

    pollingState.isRunning = true;
    
    // Start the polling timer
    const pollInterval = pollingState.intervalMinutes * 60 * 1000;
    pollingState.timer = setInterval(async () => {
      await executePoll();
    }, pollInterval);

    // Execute first poll immediately
    await executePoll();

    return reply.send({
      success: true,
      message: `Polling started with ${pollingState.intervalMinutes} minute interval`,
      interval_minutes: pollingState.intervalMinutes
    });
  });

  // Stop polling
  app.post("/polling/stop", async (request, reply) => {
    if (!pollingState.isRunning) {
      throw Object.assign(new Error("Polling is not running"), {
        status: 409,
        detail: "Polling is already stopped"
      });
    }

    pollingState.isRunning = false;
    
    if (pollingState.timer) {
      clearInterval(pollingState.timer);
      pollingState.timer = null;
    }

    return reply.send({
      success: true,
      message: "Polling stopped successfully"
    });
  });

  // Trigger manual poll
  app.post("/polling/trigger", async (request, reply) => {
    try {
      const result = await executePoll();
      
      const response: PollTriggerResponseType = {
        success: true,
        message: "Manual poll completed successfully",
        feeds_processed: result.feedsProcessed,
        articles_found: result.articlesFound,
        timestamp: new Date().toISOString()
      };

      return reply.send(response);
    } catch (error) {
      pollingState.failedPolls++;
      
      const response: PollTriggerResponseType = {
        success: false,
        message: `Poll failed: ${(error as Error).message}`,
        feeds_processed: 0,
        articles_found: 0,
        timestamp: new Date().toISOString()
      };

      return reply.code(500).send(response);
    }
  });

  // Update polling interval
  app.put("/polling/interval", async (request, reply) => {
    const body = UpdatePollingIntervalInput.parse(request.body);
    
    const wasRunning = pollingState.isRunning;
    
    // Stop current polling if running
    if (pollingState.isRunning && pollingState.timer) {
      clearInterval(pollingState.timer);
      pollingState.timer = null;
    }

    pollingState.intervalMinutes = body.interval_minutes;

    // Restart polling with new interval if it was running
    if (wasRunning) {
      pollingState.isRunning = true;
      const pollInterval = pollingState.intervalMinutes * 60 * 1000;
      pollingState.timer = setInterval(async () => {
        await executePoll();
      }, pollInterval);
    }

    return reply.send({
      success: true,
      message: `Polling interval updated to ${body.interval_minutes} minutes`,
      interval_minutes: body.interval_minutes,
      polling_restarted: wasRunning
    });
  });

  // Get active feeds status
  app.get("/polling/feeds/status", async (request, reply) => {
    const feeds = feedRepository.findActive();

    const feedStatuses = feeds.map(feed => {
      // Real implementation would track actual feed metrics in database
      // For now, return basic status based on feed data
      const lastFetchTime = feed.last_fetched;
      const nextFetchTime = pollingState.isRunning
        ? new Date(Date.now() + pollingState.intervalMinutes * 60 * 1000).toISOString()
        : null;

      const feedStatus: ActiveFeedStatusType = {
        feed_id: feed.id,
        feed_name: feed.name,
        feed_url: feed.url,
        status: "unknown",
        last_fetch_time: lastFetchTime || null,
        next_fetch_time: nextFetchTime,
        success_rate: 0,
        consecutive_failures: 0,
        total_fetches_24h: 0,
        successful_fetches_24h: 0,
        avg_response_time: 0,
        articles_fetched_24h: 0
      };

      return feedStatus;
    });

    const summary = {
      total_active_feeds: feedStatuses.length,
      healthy_feeds: 0,
      warning_feeds: 0,
      critical_feeds: 0,
      avg_success_rate: 0
    };

    const response: ActiveFeedsStatusResponseType = {
      polling_active: pollingState.isRunning,
      feeds: feedStatuses,
      summary
    };

    return reply.send(response);
  });
}

// Helper function to execute a poll
async function executePoll(): Promise<{ feedsProcessed: number; articlesFound: number }> {
  const db = getDatabase();
  const llmService = new LLMService();
  
  try {
    pollingState.lastPollTime = new Date().toISOString();
    pollingState.totalPolls++;

    // Get active feeds
    const activeFeeds = feedRepository.findActive();

    let totalArticlesFound = 0;

    // Process each feed
    for (const feed of activeFeeds) {
      try {
        console.log(`Polling feed: ${feed.name} (${feed.url})`);
        
        const feedArticles = await fetchAndParseRSSFeed(feed.url);
        console.log(`Found ${feedArticles.length} articles in ${feed.name}`);
        
        let newArticles = 0;
        
        for (const article of feedArticles) {
          if (!article.url || !article.title) continue;
          
          // Check if article already exists by URL
          const existing = articleRepository.findByUrl(article.url);
          
          if (!existing) {
            // Process article with enhanced LLM integration
            const processedArticle = await processArticleWithLLM(article, feed, llmService);
            
            // Insert new article using repository
            const articleId = generateUUID();
            articleRepository.create({
              id: articleId,
              feed_id: feed.id,
              title: processedArticle.title,
              description: processedArticle.description || null,
              content: processedArticle.content || null,
              url: processedArticle.url,
              detected_language: processedArticle.detectedLanguage,
              needs_manual_language_review: processedArticle.needsManualReview,
              summary: processedArticle.summary || null,
              original_language: processedArticle.originalLanguage,
              published_at: processedArticle.pubDate || new Date().toISOString(),
              scraped_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            });
            
            newArticles++;
          }
        }
        
        totalArticlesFound += newArticles;
        
        // Update feed timestamp to track polling activity
        feedRepository.updateLastFetched(feed.id);
        
        if (newArticles > 0) {
          console.log(`Added ${newArticles} new articles from ${feed.name}`);
        }
        
      } catch (error) {
        console.error(`Failed to poll feed ${feed.name}: ${error}`);
      }
    }

    pollingState.successfulPolls++;
    
    return {
      feedsProcessed: activeFeeds.length,
      articlesFound: totalArticlesFound
    };
  } catch (error) {
    pollingState.failedPolls++;
    throw error;
  }
}

// RSS parsing function
async function fetchAndParseRSSFeed(feedUrl: string): Promise<Array<{
  title: string;
  url: string;
  description?: string;
  content?: string;
  pubDate?: string;
  author?: string;
  guid?: string;
}>> {
  const Parser = (await import('rss-parser')).default;
  const parser = new Parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; GlobalNewsLetter/1.0)'
    },
    customFields: {
      item: [
        ['content:encoded', 'contentEncoded'],
        ['dc:creator', 'creator']
      ]
    }
  });

  try {
    const feed = await parser.parseURL(feedUrl);
    
    return feed.items.map(item => ({
      title: item.title || 'Untitled',
      url: item.link || item.guid || '',
      description: item.contentSnippet || item.summary,
      content: (item as any).contentEncoded || item.content,
      pubDate: item.pubDate || item.isoDate,
      author: item.creator || (item as any).author,
      guid: item.guid
    }));
  } catch (error) {
    throw new Error(`Failed to parse RSS feed ${feedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Language detection function  
function detectArticleLanguage(article: {
  title: string;
  description?: string;
  content?: string;
  url: string;
}): {
  detectedLanguage: string | null;
  needsManualReview: boolean;
} {
  const { LanguageDetectionService } = require('../services/language-detection.js');
  const detector = new LanguageDetectionService();
  
  const result = detector.detectArticleLanguage(article);
  
  return {
    detectedLanguage: result.detectedLanguage,
    needsManualReview: result.needsManualReview
  };
}

// Enhanced article processing with LLM integration
async function processArticleWithLLM(
  article: {
    title: string;
    url: string;
    description?: string;
    content?: string;
    pubDate?: string;
    author?: string;
    guid?: string;
  },
  feed: { id: string; url: string; name: string; language?: string },
  llmService: LLMService
): Promise<{
  title: string;
  url: string;
  description?: string;
  content?: string;
  pubDate?: string;
  author?: string;
  guid?: string;
  detectedLanguage: string | null;
  needsManualReview: boolean;
  summary?: string;
  originalLanguage: string;
}> {
  try {
    // Fallback language detection using existing service
    const fallbackLanguageResult = detectArticleLanguage({
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url
    });

    // Enhanced language detection using LLM
    let detectedLanguage = fallbackLanguageResult.detectedLanguage;
    let needsManualReview = fallbackLanguageResult.needsManualReview;

    try {
      const llmLanguageResult = await llmService.detectLanguage(article.title + ' ' + (article.description || ''));
      detectedLanguage = llmLanguageResult.language;
      needsManualReview = llmLanguageResult.confidence < 0.8;
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'LLM language detection', 
        articleUrl: article.url 
      });
      // Continue with fallback detection
    }

    // Generate summary using LLM
    let summary: string | undefined;
    try {
      if (detectedLanguage) {
        const { summary: generatedSummary } = await llmService.processArticle(
          article.title,
          article.description || null,
          article.content || null,
          detectedLanguage as any // Type assertion for supported languages
        );
        summary = generatedSummary;
      }
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'LLM summary generation', 
        articleUrl: article.url 
      });
      // Continue without summary
    }

    return {
      ...article,
      detectedLanguage,
      needsManualReview,
      summary,
      originalLanguage: detectedLanguage || 'unknown'
    };
  } catch (error) {
    ErrorHandler.logError(error as Error, { 
      operation: 'processArticleWithLLM', 
      articleUrl: article.url 
    });
    
    // Return article with fallback processing
    const fallbackResult = detectArticleLanguage({
      title: article.title,
      description: article.description,
      content: article.content,
      url: article.url
    });
    
    return {
      ...article,
      detectedLanguage: fallbackResult.detectedLanguage,
      needsManualReview: true, // Mark for manual review on errors
      originalLanguage: fallbackResult.detectedLanguage || 'unknown'
    };
  }
}

// UUID generation function
function generateUUID(): string {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}