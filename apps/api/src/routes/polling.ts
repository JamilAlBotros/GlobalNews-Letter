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
  ActiveFeedStatusType,
  PollingJob,
  CreatePollingJobInput,
  UpdatePollingJobInput,
  PollingJobsResponse,
  ManualPollInput,
  PollingJobType,
  CreatePollingJobInputType,
  UpdatePollingJobInputType,
  PollingJobsResponseType,
  ManualPollInputType
} from "../schemas/polling.js";
import { getDatabase } from "../database/connection.js";
import { LLMService } from "../services/llm.js";
import { ErrorHandler } from "../utils/errors.js";
import { articleRepository, feedRepository } from "../repositories/index.js";
import { pollingJobRepository } from "../repositories/polling-job.js";
import { pollingScheduler } from "../services/polling-scheduler.js";
import type { DatabaseArticle, DatabaseRSSFeed, Language, Category } from "../types/index.js";
import { LanguageDetectionService } from '../services/language-detection.js';
import { v4 as uuidv4 } from 'uuid';

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
    const feedStats = await feedRepository.getStatistics();
    const activeFeedsCount = feedStats.active;
    const schedulerStatus = pollingScheduler.getStatus();

    const nextPollTime = pollingState.isRunning && pollingState.lastPollTime
      ? new Date(new Date(pollingState.lastPollTime).getTime() + pollingState.intervalMinutes * 60 * 1000).toISOString()
      : null;

    const status: PollingStatusType = {
      is_running: pollingState.isRunning || schedulerStatus.isRunning,
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

  // Start polling (includes scheduler)
  app.post("/polling/start", async (request, reply) => {
    const body = StartPollingInput.parse(request.body);
    const schedulerStatus = pollingScheduler.getStatus();
    
    if (pollingState.isRunning || schedulerStatus.isRunning) {
      throw Object.assign(new Error("Polling is already running"), {
        status: 409,
        detail: "Stop polling first before starting again"
      });
    }

    if (body.interval_minutes) {
      pollingState.intervalMinutes = body.interval_minutes;
    }

    // Start both legacy polling and new scheduler
    pollingState.isRunning = true;
    
    // Start the polling timer (legacy)
    const pollInterval = pollingState.intervalMinutes * 60 * 1000;
    pollingState.timer = setInterval(async () => {
      await executePoll();
    }, pollInterval);

    // Start the polling scheduler for jobs
    await pollingScheduler.start();

    // Execute first poll immediately
    await executePoll();

    return reply.send({
      success: true,
      message: `Polling started with ${pollingState.intervalMinutes} minute interval (includes job scheduler)`,
      interval_minutes: pollingState.intervalMinutes
    });
  });

  // Stop polling (includes scheduler)
  app.post("/polling/stop", async (request, reply) => {
    const schedulerStatus = pollingScheduler.getStatus();
    
    if (!pollingState.isRunning && !schedulerStatus.isRunning) {
      throw Object.assign(new Error("Polling is not running"), {
        status: 409,
        detail: "Polling is already stopped"
      });
    }

    // Stop legacy polling
    pollingState.isRunning = false;
    
    if (pollingState.timer) {
      clearInterval(pollingState.timer);
      pollingState.timer = null;
    }

    // Stop polling scheduler
    await pollingScheduler.stop();

    return reply.send({
      success: true,
      message: "Polling stopped successfully (includes job scheduler)"
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
    const feeds = await feedRepository.findActive();
    const schedulerStatus = pollingScheduler.getStatus();

    const feedStatuses = feeds.map(feed => {
      // Real implementation would track actual feed metrics in database
      // For now, return basic status based on feed data
      const lastFetchTime = feed.last_fetched;
      const nextFetchTime = (pollingState.isRunning || schedulerStatus.isRunning)
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
      polling_active: pollingState.isRunning || schedulerStatus.isRunning,
      feeds: feedStatuses,
      summary
    };

    return reply.send(response);
  });

  // Process article with LLM (user-triggered)
  app.post("/articles/:articleId/process", async (request, reply) => {
    const { articleId } = request.params as { articleId: string };
    const llmService = new LLMService();
    
    // Get article from database
    const article = await articleRepository.findById(articleId);
    if (!article) {
      throw Object.assign(new Error("Article not found"), {
        status: 404,
        detail: `Article with ID ${articleId} does not exist`
      });
    }

    try {
      // Get feed info for processing context
      const feed = await feedRepository.findById(article.feed_id);
      
      // Process with LLM
      const processedResult = await processArticleWithLLM({
        title: article.title,
        url: article.url,
        description: article.description || undefined,
        content: article.content || undefined,
        pubDate: article.published_at,
        author: undefined,
        guid: undefined
      }, { 
        id: article.feed_id, 
        url: feed?.url || '', 
        name: feed?.name || 'Unknown Feed' 
      }, llmService);

      // Update article with processed data
      await articleRepository.update(articleId, {
        detected_language: processedResult.detectedLanguage,
        needs_manual_language_review: processedResult.needsManualReview,
        summary: processedResult.summary || null,
        original_language: processedResult.originalLanguage
      });

      return reply.send({
        success: true,
        message: "Article processed successfully",
        article_id: articleId,
        detected_language: processedResult.detectedLanguage,
        summary: processedResult.summary,
        needs_manual_review: processedResult.needsManualReview
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: `Failed to process article: ${(error as Error).message}`,
        article_id: articleId
      });
    }
  });

  // POLLING JOBS MANAGEMENT
  
  // Get all polling jobs
  app.get("/polling/jobs", async (request, reply) => {
    const { page = 1, limit = 20 } = request.query as { page?: number; limit?: number };
    
    const result = await pollingJobRepository.findAll(Number(page), Number(limit));
    
    const jobs = result.data.map(job => ({
      ...job,
      description: job.description || undefined,
      feed_filters: JSON.parse(job.feed_filters),
      last_run_stats: job.last_run_stats ? JSON.parse(job.last_run_stats) : null
    }));
    
    const response: PollingJobsResponseType = {
      data: jobs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: result.total,
        total_pages: Math.ceil(result.total / Number(limit))
      }
    };
    
    return reply.send(response);
  });

  // Get single polling job
  app.get("/polling/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const job = await pollingJobRepository.findById(jobId);
    if (!job) {
      throw Object.assign(new Error("Polling job not found"), {
        status: 404,
        detail: `Polling job with ID ${jobId} does not exist`
      });
    }
    
    const response = {
      ...job,
      description: job.description || undefined,
      feed_filters: JSON.parse(job.feed_filters),
      last_run_stats: job.last_run_stats ? JSON.parse(job.last_run_stats) : null
    };
    
    return reply.send(response);
  });

  // Create new polling job
  app.post("/polling/jobs", async (request, reply) => {
    const body = CreatePollingJobInput.parse(request.body);
    
    // Check if we have reached the limit of 10 jobs
    const existingJobs = await pollingJobRepository.findAll(1, 100);
    if (existingJobs.total >= 10) {
      throw Object.assign(new Error("Maximum polling jobs limit reached"), {
        status: 400,
        detail: "You can have a maximum of 10 polling jobs"
      });
    }
    
    const job = await pollingJobRepository.create(body);
    
    const response = {
      ...job,
      description: job.description || undefined,
      feed_filters: JSON.parse(job.feed_filters),
      last_run_stats: job.last_run_stats ? JSON.parse(job.last_run_stats) : null
    };
    
    return reply.code(201).send(response);
  });

  // Update polling job
  app.put("/polling/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const body = UpdatePollingJobInput.parse(request.body);
    
    const job = await pollingJobRepository.update(jobId, body);
    if (!job) {
      throw Object.assign(new Error("Polling job not found"), {
        status: 404,
        detail: `Polling job with ID ${jobId} does not exist`
      });
    }
    
    const response = {
      ...job,
      description: job.description || undefined,
      feed_filters: JSON.parse(job.feed_filters),
      last_run_stats: job.last_run_stats ? JSON.parse(job.last_run_stats) : null
    };
    
    return reply.send(response);
  });

  // Delete polling job
  app.delete("/polling/jobs/:jobId", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const deleted = await pollingJobRepository.delete(jobId);
    if (!deleted) {
      throw Object.assign(new Error("Polling job not found"), {
        status: 404,
        detail: `Polling job with ID ${jobId} does not exist`
      });
    }
    
    return reply.code(204).send();
  });

  // Execute polling job manually
  app.post("/polling/jobs/:jobId/execute", async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    
    const job = await pollingJobRepository.findById(jobId);
    if (!job) {
      throw Object.assign(new Error("Polling job not found"), {
        status: 404,
        detail: `Polling job with ID ${jobId} does not exist`
      });
    }
    
    try {
      const filters = JSON.parse(job.feed_filters);
      const startTime = performance.now();
      const result = await executePollingJobWithFilters(filters);
      const endTime = performance.now();
      
      // Update job stats
      await pollingJobRepository.updateRunStats(jobId, {
        feeds_processed: result.feedsProcessed,
        articles_found: result.articlesFound,
        execution_time_ms: endTime - startTime
      }, true);
      
      return reply.send({
        success: true,
        message: "Polling job executed successfully",
        job_id: jobId,
        feeds_processed: result.feedsProcessed,
        articles_found: result.articlesFound,
        execution_time_ms: endTime - startTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Update job stats for failure
      await pollingJobRepository.updateRunStats(jobId, {
        feeds_processed: 0,
        articles_found: 0,
        execution_time_ms: 0
      }, false);
      
      return reply.code(500).send({
        success: false,
        message: `Failed to execute polling job: ${(error as Error).message}`,
        job_id: jobId,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Manual poll with filters
  app.post("/polling/manual", async (request, reply) => {
    const body = ManualPollInput.parse(request.body);
    
    try {
      const startTime = performance.now();
      const result = await executePollingJobWithFilters(body.feed_filters || {});
      const endTime = performance.now();
      
      return reply.send({
        success: true,
        message: "Manual poll with filters completed successfully",
        feeds_processed: result.feedsProcessed,
        articles_found: result.articlesFound,
        execution_time_ms: endTime - startTime,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: `Manual poll failed: ${(error as Error).message}`,
        feeds_processed: 0,
        articles_found: 0,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Get polling job execution logs
  app.get("/polling/jobs/logs", async (request, reply) => {
    const { page = 1, limit = 50, job_id, status } = request.query as { 
      page?: number; 
      limit?: number; 
      job_id?: string;
      status?: 'success' | 'failure' | 'all';
    };
    
    const result = await pollingJobRepository.findAll(1, 100); // Get all jobs first
    const jobs = result.data;
    
    // Create log entries from job execution history
    const logs = jobs.map(job => {
      const lastRunStats = job.last_run_stats ? JSON.parse(job.last_run_stats) : null;
      const hasRecentRun = job.last_run_time && new Date(job.last_run_time) > new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      return {
        job_id: job.id,
        job_name: job.name,
        execution_time: job.last_run_time,
        status: hasRecentRun && lastRunStats ? 'success' : (job.failed_runs > 0 ? 'failure' : 'pending'),
        feeds_processed: lastRunStats?.feeds_processed || 0,
        articles_found: lastRunStats?.articles_found || 0,
        execution_time_ms: lastRunStats?.execution_time_ms || 0,
        total_runs: job.total_runs,
        successful_runs: job.successful_runs,
        failed_runs: job.failed_runs,
        next_run_time: job.next_run_time,
        is_active: job.is_active,
        interval_minutes: job.interval_minutes
      };
    }).filter(log => {
      // Filter by job_id if provided
      if (job_id && log.job_id !== job_id) return false;
      
      // Filter by status if provided
      if (status && status !== 'all' && log.status !== status) return false;
      
      return true;
    }).sort((a, b) => {
      // Sort by execution time, most recent first
      if (!a.execution_time && !b.execution_time) return 0;
      if (!a.execution_time) return 1;
      if (!b.execution_time) return -1;
      return new Date(b.execution_time).getTime() - new Date(a.execution_time).getTime();
    });
    
    // Apply pagination
    const offset = (Number(page) - 1) * Number(limit);
    const paginatedLogs = logs.slice(offset, offset + Number(limit));
    
    return reply.send({
      data: paginatedLogs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: logs.length,
        total_pages: Math.ceil(logs.length / Number(limit))
      },
      summary: {
        total_jobs: jobs.length,
        active_jobs: jobs.filter(j => j.is_active).length,
        total_successful_runs: jobs.reduce((sum, j) => sum + j.successful_runs, 0),
        total_failed_runs: jobs.reduce((sum, j) => sum + j.failed_runs, 0),
        recent_executions_24h: logs.filter(l => l.execution_time && new Date(l.execution_time) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length
      }
    });
  });
}

// Helper function to execute a poll
async function executePoll(): Promise<{ feedsProcessed: number; articlesFound: number }> {
  const db = getDatabase();
  
  try {
    pollingState.lastPollTime = new Date().toISOString();
    pollingState.totalPolls++;

    // Get active feeds
    const activeFeeds = await feedRepository.findActive();

    let totalArticlesFound = 0;

    // Process each feed
    for (const feed of activeFeeds) {
      try {
        const feedArticles = await fetchAndParseRSSFeed(feed.url);
        
        let newArticles = 0;
        
        for (const article of feedArticles) {
          if (!article.url || !article.title) continue;
          
          // Check if article already exists by URL
          const existing = await articleRepository.findByUrl(article.url);
          
          if (!existing) {
            // Save article immediately without LLM processing
            const articleId = generateUUID();
            await articleRepository.create({
              id: articleId,
              feed_id: feed.id,
              title: article.title,
              description: article.description || null,
              content: article.content || null,
              url: article.url,
              detected_language: null, // Will be set when user requests processing
              needs_manual_language_review: false,
              summary: null, // Will be generated when user requests processing
              original_language: null, // Will be set when user requests processing
              published_at: article.pubDate || new Date().toISOString(),
              scraped_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            });
            
            newArticles++;
          }
        }
        
        totalArticlesFound += newArticles;
        
        // Update feed timestamp to track polling activity
        await feedRepository.updateLastFetched(feed.id);
        
        // Articles added successfully
        
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

// Helper function to execute polling with filters
async function executePollingJobWithFilters(filters: any): Promise<{ feedsProcessed: number; articlesFound: number }> {
  try {
    // Get feeds based on filters
    let feeds = await feedRepository.findActive();
    
    // Apply filters
    if (filters.feed_ids && filters.feed_ids.length > 0) {
      feeds = feeds.filter(feed => filters.feed_ids.includes(feed.id));
    }
    
    if (filters.categories && filters.categories.length > 0) {
      feeds = feeds.filter(feed => filters.categories.includes(feed.category));
    }
    
    if (filters.languages && filters.languages.length > 0) {
      feeds = feeds.filter(feed => filters.languages.includes(feed.language));
    }
    
    if (filters.regions && filters.regions.length > 0) {
      feeds = feeds.filter(feed => filters.regions.includes(feed.region));
    }
    
    if (filters.types && filters.types.length > 0) {
      feeds = feeds.filter(feed => filters.types.includes(feed.type));
    }

    let totalArticlesFound = 0;

    // Process each filtered feed
    for (const feed of feeds) {
      try {
        const feedArticles = await fetchAndParseRSSFeed(feed.url);
        
        let newArticles = 0;
        
        for (const article of feedArticles) {
          if (!article.url || !article.title) continue;
          
          // Check if article already exists by URL
          const existing = await articleRepository.findByUrl(article.url);
          
          if (!existing) {
            // Save article immediately without LLM processing
            const articleId = generateUUID();
            await articleRepository.create({
              id: articleId,
              feed_id: feed.id,
              title: article.title,
              description: article.description || null,
              content: article.content || null,
              url: article.url,
              detected_language: null, // Will be set when user requests processing
              needs_manual_language_review: false,
              summary: null, // Will be generated when user requests processing
              original_language: null, // Will be set when user requests processing
              published_at: article.pubDate || new Date().toISOString(),
              scraped_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            });
            
            newArticles++;
          }
        }
        
        totalArticlesFound += newArticles;
        
        // Update feed timestamp to track polling activity
        await feedRepository.updateLastFetched(feed.id);
        
        // Articles added successfully
        
      } catch (error) {
        console.error(`Failed to poll feed ${feed.name}: ${error}`);
      }
    }
    
    return {
      feedsProcessed: feeds.length,
      articlesFound: totalArticlesFound
    };
  } catch (error) {
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
    
    if (!feed || !feed.items) {
      console.warn(`Feed ${feedUrl} returned no items`);
      return [];
    }
    
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
    // Log the error but don't throw - gracefully handle malformed feeds
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Failed to parse RSS feed ${feedUrl}: ${errorMessage}`);
    
    // Return empty array instead of throwing - allows other feeds to continue processing
    return [];
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
  return uuidv4();
}