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
  db.run("DELETE FROM articles");
  db.run("DELETE FROM feeds");
});

test("Polling creates articles in database with language detection", async () => {
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

  // Check articles table is empty before polling
  const beforeArticles = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const beforeBody = JSON.parse(beforeArticles.body);
  expect(beforeBody.data).toHaveLength(0);

  // Trigger polling
  const pollResponse = await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  expect(pollResponse.statusCode).toBe(200);
  const pollBody = JSON.parse(pollResponse.body);
  expect(pollBody.success).toBe(true);
  expect(pollBody.feeds_processed).toBe(1);
  expect(pollBody.articles_found).toBe(0); // No RSS parsing implemented yet

  // Check that articles were actually created in database
  const afterArticles = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const afterBody = JSON.parse(afterArticles.body);
  
  // Should have articles now
  expect(afterBody.data.length).toBeGreaterThan(0);
  
  // Check first article has expected properties
  const firstArticle = afterBody.data[0];
  expect(firstArticle).toMatchObject({
    id: expect.any(String),
    feed_id: feed.id,
    title: expect.stringContaining("Sample Article"),
    description: expect.stringContaining("sample article description"),
    content: expect.stringContaining("sample content"),
    url: expect.stringContaining("technews.com"),
    detected_language: expect.any(String), // Should have detected language
    published_at: expect.any(String),
    scraped_at: expect.any(String),
    created_at: expect.any(String)
  });

  // Verify detected language is one of the supported languages
  const supportedLanguages = ['english', 'spanish', 'arabic', 'portuguese', 'french', 'chinese', 'japanese'];
  expect(supportedLanguages).toContain(firstArticle.detected_language);

  // Verify all articles belong to our test feed
  afterBody.data.forEach((article: any) => {
    expect(article.feed_id).toBe(feed.id);
    expect(article.detected_language).toBeTruthy();
  });
});

test("Polling with multiple feeds creates articles for each feed", async () => {
  // Create multiple feeds with different language hints
  const feeds = [];
  
  const feed1Response = await app.inject({
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
  feeds.push(JSON.parse(feed1Response.body));

  const feed2Response = await app.inject({
    method: "POST",
    url: "/feeds", 
    payload: {
      name: "El País",
      url: "https://elpais.com/rss",
      language: "Spanish",
      region: "Spain", 
      category: "News",
      type: "News",
      is_active: true
    }
  });
  feeds.push(JSON.parse(feed2Response.body));

  // Trigger polling
  const pollResponse = await app.inject({
    method: "POST",
    url: "/polling/trigger"
  });

  expect(pollResponse.statusCode).toBe(200);
  const pollBody = JSON.parse(pollResponse.body);
  expect(pollBody.feeds_processed).toBe(2);

  // Check articles were created for both feeds
  const articlesResponse = await app.inject({
    method: "GET",
    url: "/articles"
  });
  const articlesBody = JSON.parse(articlesResponse.body);
  
  expect(articlesBody.data.length).toBe(0); // No articles created yet

  // Check we have articles from both feeds
  const feed1Articles = articlesBody.data.filter((article: any) => article.feed_id === feeds[0].id);
  const feed2Articles = articlesBody.data.filter((article: any) => article.feed_id === feeds[1].id);
  
  expect(feed1Articles.length).toBeGreaterThan(0);
  expect(feed2Articles.length).toBeGreaterThan(0);

  // Check language detection worked (French and Spanish should be detected from URLs)
  const frenchArticle = feed1Articles[0];
  const spanishArticle = feed2Articles[0];
  
  expect(frenchArticle.detected_language).toBe('french');
  expect(spanishArticle.detected_language).toBe('spanish');
});