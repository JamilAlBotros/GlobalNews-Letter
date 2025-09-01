import { test, expect, describe, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { pollingRoutes } from "../routes/polling.js";
import { feedRoutes } from "../routes/feeds.js";
import { getDatabase, closeDatabase, resetDatabase } from "../database/connection.js";
import { initializeDatabase } from "../database/init.js";
import { LanguageDetectionService } from "../services/language-detection.js";

let app: FastifyInstance;
let testFeedId: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await resetDatabase();
  
  app = Fastify();
  await app.register(feedRoutes);
  await app.register(pollingRoutes);
  await initializeDatabase();
});

afterAll(async () => {
  await app.close();
  await closeDatabase();
});

beforeEach(async () => {
  const db = getDatabase();
  db.run("DELETE FROM articles");
  db.run("DELETE FROM feeds");

  // Create test feeds with different languages based on URL
  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "Le Monde - French News",
      url: "https://lemonde.fr/rss",
      language: "French",
      region: "France",
      category: "News",
      type: "News",
      is_active: true
    }
  });

  const createdFeed = JSON.parse(feedResponse.body);
  testFeedId = createdFeed.id;
});

describe("Polling Integration with Language Detection", () => {
  test("GET /polling/status returns current polling state", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/polling/status"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      is_running: expect.any(Boolean),
      interval_minutes: expect.any(Number),
      total_polls: expect.any(Number),
      successful_polls: expect.any(Number),
      failed_polls: expect.any(Number),
      active_feeds_count: expect.any(Number)
    });
  });

  test("POST /polling/trigger executes manual poll with language detection", async () => {
    // Mock console.log to capture language detection output
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await app.inject({
      method: "POST",
      url: "/polling/trigger"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      success: true,
      message: "Manual poll completed successfully",
      feeds_processed: expect.any(Number),
      articles_found: expect.any(Number),
      timestamp: expect.any(String)
    });

    // TODO: When RSS parsing is implemented, test language detection logs
    // expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/Detected language/));

    // Verify that French language was detected for Le Monde URL
    const frenchDetectionCall = consoleSpy.mock.calls.find(call => 
      call[0] && call[0].includes('french') && call[0].includes('method: url')
    );
    expect(frenchDetectionCall).toBeDefined();

    consoleSpy.mockRestore();
  });

  test("Language detection service integration works correctly", () => {
    const languageDetector = new LanguageDetectionService();
    
    // Test with mock article from Le Monde (should detect French from URL)
    const mockArticle = {
      title: "Sample Article 1 from Le Monde - French News",
      description: "This is a sample article description for testing language detection.",
      content: "<p>This is sample content for testing purposes. In a real implementation, this would be the actual RSS article content.</p>",
      url: "https://lemonde.fr/rss/article-123"
    };

    const result = languageDetector.detectArticleLanguage(mockArticle);
    
    expect(result.detectedLanguage).toBe("french");
    expect(result.method).toBe("url");
    expect(result.confidence).toBe(0.85);
  });

  test("Multiple feeds with different languages are detected correctly", async () => {
    // Create additional feeds with different language URLs
    const spanishFeedResponse = await app.inject({
      method: "POST",
      url: "/feeds",
      payload: {
        name: "El País - Spanish News",
        url: "https://elpais.com/rss",
        language: "Spanish",
        region: "Spain",
        category: "News", 
        type: "News",
        is_active: true
      }
    });

    const chineseFeedResponse = await app.inject({
      method: "POST",
      url: "/feeds",
      payload: {
        name: "Sina - Chinese News",
        url: "https://sina.com.cn/rss",
        language: "Chinese",
        region: "China",
        category: "News",
        type: "News", 
        is_active: true
      }
    });

    expect(spanishFeedResponse.statusCode).toBe(201);
    expect(chineseFeedResponse.statusCode).toBe(201);

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await app.inject({
      method: "POST",
      url: "/polling/trigger"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.feeds_processed).toBe(3); // French, Spanish, Chinese feeds

    // TODO: When RSS parsing is implemented, test language detection for multiple feeds
    // expect(logCalls).toContain('french');

    consoleSpy.mockRestore();
  });

  test("Polling status reflects active feeds count correctly", async () => {
    const statusResponse = await app.inject({
      method: "GET",
      url: "/polling/status"
    });

    expect(statusResponse.statusCode).toBe(200);
    const statusBody = JSON.parse(statusResponse.body);
    expect(statusBody.active_feeds_count).toBe(1); // Only the French feed created in beforeEach
  });

  test("GET /polling/feeds/status shows feed status with language context", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/polling/feeds/status"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body).toMatchObject({
      polling_active: expect.any(Boolean),
      feeds: expect.any(Array),
      summary: expect.objectContaining({
        total_active_feeds: expect.any(Number),
        healthy_feeds: expect.any(Number),
        warning_feeds: expect.any(Number),
        critical_feeds: expect.any(Number),
        avg_success_rate: expect.any(Number)
      })
    });

    expect(body.feeds).toHaveLength(1);
    expect(body.feeds[0]).toMatchObject({
      feed_id: testFeedId,
      feed_name: "Le Monde - French News",
      feed_url: "https://lemonde.fr/rss",
      status: expect.stringMatching(/^(healthy|warning|critical|unknown)$/),
      success_rate: expect.any(Number),
      consecutive_failures: expect.any(Number),
      total_fetches_24h: expect.any(Number),
      successful_fetches_24h: expect.any(Number),
      avg_response_time: expect.any(Number),
      articles_fetched_24h: expect.any(Number)
    });
  });

  test("Polling start/stop functionality works correctly", async () => {
    // Start polling
    const startResponse = await app.inject({
      method: "POST",
      url: "/polling/start",
      payload: { interval_minutes: 30 }
    });

    expect(startResponse.statusCode).toBe(200);
    const startBody = JSON.parse(startResponse.body);
    expect(startBody).toMatchObject({
      success: true,
      message: expect.stringContaining("Polling started"),
      interval_minutes: 30
    });

    // Check status shows running
    const statusResponse = await app.inject({
      method: "GET", 
      url: "/polling/status"
    });
    const statusBody = JSON.parse(statusResponse.body);
    expect(statusBody.is_running).toBe(true);
    expect(statusBody.interval_minutes).toBe(30);

    // Stop polling
    const stopResponse = await app.inject({
      method: "POST",
      url: "/polling/stop",
      payload: {}
    });

    expect(stopResponse.statusCode).toBe(200);
    const stopBody = JSON.parse(stopResponse.body);
    expect(stopBody).toMatchObject({
      success: true,
      message: "Polling stopped successfully"
    });

    // Check status shows stopped
    const finalStatusResponse = await app.inject({
      method: "GET",
      url: "/polling/status"
    });
    const finalStatusBody = JSON.parse(finalStatusResponse.body);
    expect(finalStatusBody.is_running).toBe(false);
  });

  test("Polling interval update works correctly", async () => {
    const response = await app.inject({
      method: "PUT",
      url: "/polling/interval",
      payload: { interval_minutes: 45 }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject({
      success: true,
      message: expect.stringContaining("45 minutes"),
      interval_minutes: 45,
      polling_restarted: expect.any(Boolean)
    });

    // Verify the interval was updated
    const statusResponse = await app.inject({
      method: "GET",
      url: "/polling/status"  
    });
    const statusBody = JSON.parse(statusResponse.body);
    expect(statusBody.interval_minutes).toBe(45);
  });
});