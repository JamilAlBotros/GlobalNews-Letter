import { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
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
import { LanguageDetectionService } from "../services/language-detection.js";

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

const languageDetector = new LanguageDetectionService();

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
      // Calculate mock metrics for each feed
      const lastFetchTime = feed.updated_at;
      const timeSinceLastFetch = Date.now() - new Date(lastFetchTime).getTime();
      const hoursAgo = timeSinceLastFetch / (1000 * 60 * 60);
      
      // Determine status based on time since last fetch
      let status: "healthy" | "warning" | "critical" | "unknown";
      let successRate: number;
      let consecutiveFailures: number;
      
      if (hoursAgo < 2) {
        status = "healthy";
        successRate = 0.95 + Math.random() * 0.05;
        consecutiveFailures = 0;
      } else if (hoursAgo < 6) {
        status = "warning";
        successRate = 0.75 + Math.random() * 0.2;
        consecutiveFailures = Math.floor(Math.random() * 3);
      } else {
        status = "critical";
        successRate = 0.3 + Math.random() * 0.4;
        consecutiveFailures = Math.floor(Math.random() * 10) + 3;
      }

      const nextFetchTime = pollingState.isRunning
        ? new Date(Date.now() + pollingState.intervalMinutes * 60 * 1000).toISOString()
        : null;

      const totalFetches24h = 24;
      const successfulFetches24h = Math.floor(totalFetches24h * successRate);

      const feedStatus: ActiveFeedStatusType = {
        feed_id: feed.id,
        feed_name: feed.name,
        feed_url: feed.url,
        status,
        last_fetch_time: lastFetchTime,
        next_fetch_time: nextFetchTime,
        success_rate: Math.round(successRate * 100) / 100,
        consecutive_failures: consecutiveFailures,
        total_fetches_24h: totalFetches24h,
        successful_fetches_24h: successfulFetches24h,
        avg_response_time: Math.floor(800 + Math.random() * 2000),
        articles_fetched_24h: Math.floor(successfulFetches24h * (5 + Math.random() * 15))
      };

      return feedStatus;
    });

    const summary = {
      total_active_feeds: feedStatuses.length,
      healthy_feeds: feedStatuses.filter(f => f.status === "healthy").length,
      warning_feeds: feedStatuses.filter(f => f.status === "warning").length,
      critical_feeds: feedStatuses.filter(f => f.status === "critical").length,
      avg_success_rate: feedStatuses.length > 0 
        ? Math.round((feedStatuses.reduce((sum, f) => sum + f.success_rate, 0) / feedStatuses.length) * 100) / 100
        : 0
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
    const activeFeeds = db.all<{ id: string; url: string; name: string }>(
      "SELECT id, url, name FROM feeds WHERE is_active = 1"
    );

    let totalArticlesFound = 0;

    // Simulate processing each feed
    for (const feed of activeFeeds) {
      // Simulate finding articles with language detection
      const articlesFound = Math.floor(Math.random() * 5) + 1; // 1-5 articles
      
      for (let i = 0; i < articlesFound; i++) {
        const articleId = uuidv4();
        const now = new Date().toISOString();
        
        // Simulate article data (in real implementation, this would come from RSS parsing)
        const mockArticle = {
          title: `Sample Article ${i + 1} from ${feed.name}`,
          description: `This is a sample article description for testing language detection.`,
          content: `<p>This is sample content for testing purposes. In a real implementation, this would be the actual RSS article content.</p>`,
          url: `${feed.url}/article-${Date.now()}-${i}-${articleId}`
        };
        
        // Detect language
        const languageResult = languageDetector.detectArticleLanguage(mockArticle);
        
        console.log(`Detected language for article \"${mockArticle.title}\": ${languageResult.detectedLanguage} (confidence: ${languageResult.confidence}, method: ${languageResult.method})`);
        
        // Insert the article into the database with the detected language
        try {
          await db.run(`
            INSERT INTO articles (id, feed_id, detected_language, title, description, content, url, published_at, scraped_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            articleId,
            feed.id,
            languageResult.detectedLanguage,
            mockArticle.title,
            mockArticle.description,
            mockArticle.content,
            mockArticle.url,
            now, // published_at
            now, // scraped_at
            now  // created_at
          ]);
        } catch (error) {
          // Skip if article URL already exists (duplicate)
          if (error && (error as any).code !== 'SQLITE_CONSTRAINT_UNIQUE') {
            console.error(`Failed to insert article: ${error}`);
          }
        }
      }
      
      db.run(
        "UPDATE feeds SET updated_at = ? WHERE id = ?",
        new Date().toISOString(),
        feed.id
      );
      totalArticlesFound += articlesFound;
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