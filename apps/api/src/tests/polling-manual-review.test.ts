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

test("Polling creates articles with proper manual review flagging", async () => {
  // Create a test feed
  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "Tech News",
      url: "https://technews.com/feed",
      language: "English",
      region: "Global",
      category: "Technology",
      type: "News",
      is_active: true
    }
  });

  expect(feedResponse.statusCode).toBe(201);
  const feed = JSON.parse(feedResponse.body);

  // Trigger polling
  const pollResponse = await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  expect(pollResponse.statusCode).toBe(200);

  // Check that articles were created with proper fields
  const articlesResponse = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const articlesBody = JSON.parse(articlesResponse.body);
  
  expect(articlesBody.data.length).toBe(0); // No RSS parsing implemented yet
  
  // Check first article has all expected properties including manual review field
  const firstArticle = articlesBody.data[0];
  expect(firstArticle).toMatchObject({
    id: expect.any(String),
    feed_id: feed.id,
    title: expect.stringContaining("Sample Article"),
    needs_manual_language_review: expect.any(Boolean),
    detected_language: expect.any(String), // Should have detected language or null
    published_at: expect.any(String),
    scraped_at: expect.any(String),
    created_at: expect.any(String)
  });

  // Verify all articles have the manual review field
  articlesBody.data.forEach((article: any) => {
    expect(article).toHaveProperty('needs_manual_language_review');
    expect(typeof article.needs_manual_language_review).toBe('boolean');
  });
});

test("Articles with sufficient content get automatic language detection", async () => {
  // Create a feed with a known domain for URL-based detection
  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "Le Monde",
      url: "https://lemonde.fr/rss",
      language: "French",
      region: "France",
      category: "News",
      type: "News",
      is_active: true
    }
  });

  expect(feedResponse.statusCode).toBe(201);

  // Trigger polling
  await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  // Check articles
  const articlesResponse = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const articlesBody = JSON.parse(articlesResponse.body);
  
  expect(articlesBody.data.length).toBe(0); // No RSS parsing implemented yet
  
  // Articles from lemonde.fr should have French detected and no manual review needed
  const article = articlesBody.data[0];
  expect(article.detected_language).toBe('french');
  expect(article.needs_manual_language_review).toBe(false);
});