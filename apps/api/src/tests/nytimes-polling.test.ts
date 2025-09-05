import { test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { pollingRoutes } from "../routes/polling.js";
import { feedRoutes } from "../routes/feeds.js";
import { articleRoutes } from "../routes/articles.js";
import { getDatabase, closeDatabase, resetDatabase } from "../database/connection.js";
import { initializeDatabase } from "../database/init.js";

let app: FastifyInstance;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await resetDatabase();
  
  app = Fastify();
  await app.register(feedRoutes);
  await app.register(pollingRoutes);
  await app.register(articleRoutes);
  await initializeDatabase();
});

afterAll(async () => {
  await app.close();
  await closeDatabase();
});

beforeEach(async () => {
  const db = getDatabase();
  await db.run("DELETE FROM articles");
  await db.run("DELETE FROM feeds");
});

test("NY Times RSS feed polling creates articles in database", async () => {
  // Create The NY Times RSS feed
  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "The New York Times Homepage",
      url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      language: "English",
      region: "US",
      category: "News",
      type: "News",
      is_active: true
    }
  });

  expect(feedResponse.statusCode).toBe(201);
  const feed = JSON.parse(feedResponse.body);

  // Check articles table is empty before polling
  const beforeArticles = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const beforeBody = JSON.parse(beforeArticles.body);
  expect(beforeBody.data).toHaveLength(0);

  // Trigger manual polling
  const pollResponse = await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  expect(pollResponse.statusCode).toBe(200);
  const pollBody = JSON.parse(pollResponse.body);
  expect(pollBody.success).toBe(true);
  expect(pollBody.feeds_processed).toBe(1);
  expect(pollBody.articles_found).toBeGreaterThan(0);

  // Check that articles were actually created in database
  const afterArticles = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const afterBody = JSON.parse(afterArticles.body);
  
  // Should have articles now from The Guardian RSS feed
  expect(afterBody.data.length).toBeGreaterThan(0);
  
  // Check first article has expected properties
  const firstArticle = afterBody.data[0];
  expect(firstArticle).toMatchObject({
    id: expect.any(String),
    feed_id: feed.id,
    title: expect.any(String),
    url: expect.stringContaining("nytimes.com"),
    detected_language: expect.any(String),
    published_at: expect.any(String),
    scraped_at: expect.any(String),
    created_at: expect.any(String)
  });

  // Verify detected language is one of the supported languages
  const supportedLanguages = ['english', 'spanish', 'arabic', 'portuguese', 'french', 'chinese', 'japanese'];
  expect(supportedLanguages).toContain(firstArticle.detected_language);

  // Verify all articles belong to our NY Times feed
  afterBody.data.forEach((article: any) => {
    expect(article.feed_id).toBe(feed.id);
    expect(article.url).toContain('nytimes.com');
    expect(article.title).toBeTruthy();
  });

  // Verify we have both manual review flags
  afterBody.data.forEach((article: any) => {
    expect(article).toHaveProperty('needs_manual_language_review');
    expect(typeof article.needs_manual_language_review).toBe('boolean');
  });

  console.log(`✅ Successfully fetched ${afterBody.data.length} articles from The NY Times RSS feed`);
}, 30000); // 30 second timeout for live RSS fetching

test("NY Times RSS feed polling handles duplicate articles correctly", async () => {
  // Create The NY Times RSS feed
  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "The New York Times Homepage",
      url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      language: "English",
      region: "US", 
      category: "News",
      type: "News",
      is_active: true
    }
  });

  expect(feedResponse.statusCode).toBe(201);

  // First polling run
  const pollResponse1 = await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  expect(pollResponse1.statusCode).toBe(200);
  const pollBody1 = JSON.parse(pollResponse1.body);
  const firstRunArticles = pollBody1.articles_found;

  // Check articles in database after first run
  const afterFirstRun = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const firstRunBody = JSON.parse(afterFirstRun.body);
  expect(firstRunBody.data.length).toBe(firstRunArticles);

  // Second polling run (should find no new articles since they're duplicates)
  const pollResponse2 = await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  expect(pollResponse2.statusCode).toBe(200);
  const pollBody2 = JSON.parse(pollResponse2.body);
  expect(pollBody2.articles_found).toBe(0); // No new articles should be found

  // Verify database still has same number of articles
  const afterSecondRun = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const secondRunBody = JSON.parse(afterSecondRun.body);
  expect(secondRunBody.data.length).toBe(firstRunArticles);

  console.log(`✅ Duplicate handling works correctly - no duplicates added on second poll`);
}, 30000);

test("NY Times RSS feed polling detects English language correctly", async () => {
  // Create The NY Times RSS feed 
  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "The New York Times Homepage",
      url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
      language: "English",
      region: "US",
      category: "News",
      type: "News",
      is_active: true
    }
  });

  expect(feedResponse.statusCode).toBe(201);

  // Trigger polling
  const pollResponse = await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  expect(pollResponse.statusCode).toBe(200);

  // Check articles language detection
  const articlesResponse = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const articlesBody = JSON.parse(articlesResponse.body);
  
  expect(articlesBody.data.length).toBeGreaterThan(0);

  // Most NY Times articles should be detected as English
  const englishArticles = articlesBody.data.filter((article: any) => 
    article.detected_language === 'english'
  );
  
  // Expect at least 80% of articles to be detected as English
  const englishPercentage = englishArticles.length / articlesBody.data.length;
  expect(englishPercentage).toBeGreaterThan(0.8);

  console.log(`✅ Language detection working: ${englishArticles.length}/${articlesBody.data.length} articles detected as English`);
}, 30000);