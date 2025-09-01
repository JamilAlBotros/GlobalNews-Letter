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

  // Get current polling status
  app.get("/polling/status", async (request, reply) => {
    const activeFeedsCount = db.get<{ count: number }>(
      "SELECT COUNT(*) as count FROM feeds WHERE is_active = 1"
    )?.count || 0;

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
    const feeds = db.all<{
      id: string;
      name: string;
      url: string;
      updated_at: string;
    }>("SELECT id, name, url, updated_at FROM feeds WHERE is_active = 1");

    const feedStatuses = feeds.map(feed => {
      // Real implementation would track actual feed metrics in database
      // For now, return basic status based on feed data
      const lastFetchTime = feed.updated_at;
      const nextFetchTime = pollingState.isRunning
        ? new Date(Date.now() + pollingState.intervalMinutes * 60 * 1000).toISOString()
        : null;

      const feedStatus: ActiveFeedStatusType = {
        feed_id: feed.id,
        feed_name: feed.name,
        feed_url: feed.url,
        status: "unknown",
        last_fetch_time: lastFetchTime,
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
  
  try {
    pollingState.lastPollTime = new Date().toISOString();
    pollingState.totalPolls++;

    // Get active feeds
    const activeFeeds = db.all<{ id: string; url: string; name: string; language?: string }>(
      "SELECT id, url, name, language FROM feeds WHERE is_active = 1"
    );

    let totalArticlesFound = 0;

    // Process each feed
    for (const feed of activeFeeds) {
      try {
        console.log(`Polling feed: ${feed.name} (${feed.url})`);
        
        const feedArticles = await fetchAndParseRSSFeed(feed.url);
        console.log(`Found ${feedArticles.length} articles in ${feed.name}`);
        
        let newArticles = 0;
        
        for (const article of feedArticles) {
          // Check if article already exists by URL
          const existing = db.get<{ id: string }>(
            "SELECT id FROM articles WHERE url = ?", 
            [article.url]
          );
          
          if (!existing && article.url && article.title) {
            // Detect language for the article
            const languageResult = detectArticleLanguage({
              title: article.title,
              description: article.description,
              content: article.content,
              url: article.url
            });
            
            // Insert new article
            const articleId = generateUUID();
            db.run(`
              INSERT INTO articles (
                id, feed_id, title, description, content, url, 
                detected_language, needs_manual_language_review,
                published_at, scraped_at, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              articleId,
              feed.id,
              article.title,
              article.description,
              article.content,
              article.url,
              languageResult.detectedLanguage,
              languageResult.needsManualReview,
              article.pubDate || new Date().toISOString(),
              new Date().toISOString(),
              new Date().toISOString()
            ]);
            
            newArticles++;
          }
        }
        
        totalArticlesFound += newArticles;
        
        // Update feed timestamp to track polling activity
        db.run(
          "UPDATE feeds SET updated_at = ? WHERE id = ?",
          new Date().toISOString(),
          feed.id
        );
        
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

// UUID generation function
function generateUUID(): string {
  const { v4: uuidv4 } = require('uuid');
  return uuidv4();
}