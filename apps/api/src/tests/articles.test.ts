import { test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { articleRoutes } from "../routes/articles.js";
import { feedRoutes } from "../routes/feeds.js";
import { TestDatabase } from "./setup/test-database.js";

let app: FastifyInstance;
let testDb: TestDatabase;
let testFeedId: string;

beforeAll(async () => {
  // Setup test database
  testDb = new TestDatabase();
  await testDb.setup();
  
  app = Fastify();
  await app.register(feedRoutes);
  await app.register(articleRoutes);
});

afterAll(async () => {
  await testDb.cleanup();
  await app.close();
});

beforeEach(async () => {
  const db = testDb.getConnection();
  if (db) {
    await db.run("DELETE FROM articles");
    await db.run("DELETE FROM feeds");
  }

  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "Test Feed",
      url: "https://test.com/feed",
      language: "English",
      region: "Global",
      category: "News",
      type: "News",
      is_active: true
    }
  });

  const createdFeed = JSON.parse(feedResponse.body);
  testFeedId = createdFeed.id;
});

test("GET /articles returns empty array when no articles", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/articles"
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.data).toEqual([]);
  expect(body.pagination).toMatchObject({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  });
});

test("POST /articles creates a new article", async () => {
  const articleData = {
    feed_id: testFeedId,
    title: "Breaking News: Test Article",
    description: "This is a test article description",
    content: "Full content of the test article",
    url: "https://test.com/article1",
    published_at: "2024-01-01T12:00:00Z",
    detected_language: "english",
    needs_manual_language_review: false
  };

  const response = await app.inject({
    method: "POST",
    url: "/articles",
    payload: articleData
  });

  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.body);
  expect(body).toMatchObject({
    feed_id: testFeedId,
    title: "Breaking News: Test Article",
    description: "This is a test article description",
    content: "Full content of the test article",
    url: "https://test.com/article1",
    published_at: "2024-01-01T12:00:00Z",
    detected_language: "english",
    needs_manual_language_review: false
  });
  expect(body.id).toBeDefined();
  expect(body.scraped_at).toBeDefined();
  expect(body.created_at).toBeDefined();
});

test("POST /articles returns 400 for non-existent feed", async () => {
  const articleData = {
    feed_id: "550e8400-e29b-41d4-a716-446655440000",
    title: "Test Article",
    description: null,
    content: null,
    url: "https://test.com/article2",
    published_at: "2024-01-01T12:00:00Z",
    detected_language: null,
    needs_manual_language_review: true
  };

  const response = await app.inject({
    method: "POST",
    url: "/articles",
    payload: articleData
  });

  expect(response.statusCode).toBe(400);
  const body = JSON.parse(response.body);
  expect(body.title).toBe("Feed not found");
});

test("POST /articles returns 409 for duplicate URL", async () => {
  const articleData = {
    feed_id: testFeedId,
    title: "Original Article",
    description: null,
    content: null,
    url: "https://test.com/duplicate",
    published_at: "2024-01-01T12:00:00Z",
    detected_language: null,
    needs_manual_language_review: true
  };

  await app.inject({
    method: "POST",
    url: "/articles",
    payload: articleData
  });

  const response = await app.inject({
    method: "POST",
    url: "/articles",
    payload: { ...articleData, title: "Duplicate Article" }
  });

  expect(response.statusCode).toBe(409);
  const body = JSON.parse(response.body);
  expect(body.title).toBe("Article with this URL already exists");
});

test("GET /articles/:id returns article by ID", async () => {
  const articleData = {
    feed_id: testFeedId,
    title: "Single Article Test",
    description: "Description for single article",
    content: "Content for single article",
    url: "https://test.com/single",
    published_at: "2024-01-01T12:00:00Z",
    detected_language: "english",
    needs_manual_language_review: false
  };

  const createResponse = await app.inject({
    method: "POST",
    url: "/articles",
    payload: articleData
  });

  const createdArticle = JSON.parse(createResponse.body);

  const response = await app.inject({
    method: "GET",
    url: `/articles/${createdArticle.id}`
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.title).toBe("Single Article Test");
  expect(body.id).toBe(createdArticle.id);
});

test("GET /articles/:id returns 404 for non-existent article", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/articles/550e8400-e29b-41d4-a716-446655440000"
  });

  expect(response.statusCode).toBe(404);
  const body = JSON.parse(response.body);
  expect(body.title).toBe("Article not found");
});

test("GET /articles filters by feed_id", async () => {
  const secondFeedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "Second Feed",
      url: "https://test2.com/feed",
      language: "English",
      region: "Global",
      category: "Technology",
      type: "News",
      is_active: true
    }
  });

  const secondFeed = JSON.parse(secondFeedResponse.body);

  await app.inject({
    method: "POST",
    url: "/articles",
    payload: {
      feed_id: testFeedId,
      title: "Article from Feed 1",
      description: null,
      content: null,
      url: "https://test.com/feed1-article",
      published_at: "2024-01-01T12:00:00Z",
      detected_language: null,
      needs_manual_language_review: true
    }
  });

  await app.inject({
    method: "POST",
    url: "/articles",
    payload: {
      feed_id: secondFeed.id,
      title: "Article from Feed 2",
      description: null,
      content: null,
      url: "https://test2.com/feed2-article",
      published_at: "2024-01-01T12:00:00Z",
      detected_language: null,
      needs_manual_language_review: true
    }
  });

  const response = await app.inject({
    method: "GET",
    url: `/articles?feed_id=${testFeedId}`
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.data).toHaveLength(1);
  expect(body.data[0].title).toBe("Article from Feed 1");
  expect(body.data[0].feed_id).toBe(testFeedId);
});

test("PUT /articles/:id updates article", async () => {
  const articleData = {
    feed_id: testFeedId,
    title: "Original Title",
    description: "Original description",
    content: "Original content",
    url: "https://test.com/update",
    published_at: "2024-01-01T12:00:00Z",
    detected_language: "english",
    needs_manual_language_review: false
  };

  const createResponse = await app.inject({
    method: "POST",
    url: "/articles",
    payload: articleData
  });

  const createdArticle = JSON.parse(createResponse.body);

  const updateData = {
    title: "Updated Title",
    description: "Updated description"
  };

  const response = await app.inject({
    method: "PUT",
    url: `/articles/${createdArticle.id}`,
    payload: updateData
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.title).toBe("Updated Title");
  expect(body.description).toBe("Updated description");
  expect(body.content).toBe("Original content");
  expect(body.url).toBe("https://test.com/update");
});

test("DELETE /articles/:id deletes article", async () => {
  const articleData = {
    feed_id: testFeedId,
    title: "To Delete",
    description: null,
    content: null,
    url: "https://test.com/delete",
    published_at: "2024-01-01T12:00:00Z",
    detected_language: null,
    needs_manual_language_review: true
  };

  const createResponse = await app.inject({
    method: "POST",
    url: "/articles",
    payload: articleData
  });

  const createdArticle = JSON.parse(createResponse.body);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/articles/${createdArticle.id}`
  });

  expect(deleteResponse.statusCode).toBe(204);

  const getResponse = await app.inject({
    method: "GET",
    url: `/articles/${createdArticle.id}`
  });

  expect(getResponse.statusCode).toBe(404);
});

test("GET /articles with pagination", async () => {
  for (let i = 0; i < 25; i++) {
    await app.inject({
      method: "POST",
      url: "/articles",
      payload: {
        feed_id: testFeedId,
        title: `Article ${i}`,
        description: null,
        content: null,
        url: `https://test.com/article${i}`,
        published_at: `2024-01-0${(i % 9) + 1}T12:00:00Z`,
        detected_language: null,
        needs_manual_language_review: true
      }
    });
  }

  const response = await app.inject({
    method: "GET",
    url: "/articles?page=2&limit=10"
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.data).toHaveLength(10);
  expect(body.pagination).toMatchObject({
    page: 2,
    limit: 10,
    total: 25,
    total_pages: 3
  });
});