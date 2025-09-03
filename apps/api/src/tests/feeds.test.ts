import { test, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { feedRoutes } from "../routes/feeds.js";
import { getDatabase, closeDatabase, resetDatabase } from "../database/connection.js";
import { initializeDatabase } from "../database/init.js";

let app: FastifyInstance;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  resetDatabase(); // Ensure clean database state
  
  app = Fastify();
  await app.register(feedRoutes);
  await initializeDatabase();
});

afterAll(async () => {
  await app.close();
  await closeDatabase();
});

beforeEach(async () => {
  const db = getDatabase();
  await db.run("DELETE FROM feeds");
});

test("GET /feeds returns empty array when no feeds", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/feeds"
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

test("POST /feeds creates a new feed", async () => {
  const feedData = {
    name: "CNN Top Stories",
    url: "https://rss.cnn.com/rss/cnn_topstories.rss",
    language: "English",
    region: "Global",
    category: "News",
    type: "News",
    is_active: true
  };

  const response = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: feedData
  });

  expect(response.statusCode).toBe(201);
  const body = JSON.parse(response.body);
  expect(body).toMatchObject({
    name: "CNN Top Stories",
    url: "https://rss.cnn.com/rss/cnn_topstories.rss",
    language: "English",
    region: "Global",
    category: "News",
    type: "News",
    is_active: true
  });
  expect(body.id).toBeDefined();
  expect(body.created_at).toBeDefined();
  expect(body.updated_at).toBeDefined();
});

test("POST /feeds returns 409 for duplicate URL", async () => {
  const feedData = {
    name: "CNN Top Stories",
    url: "https://rss.cnn.com/rss/cnn_topstories.rss",
    language: "English",
    region: "Global",
    category: "News",
    type: "News",
    is_active: true
  };

  await app.inject({
    method: "POST",
    url: "/feeds",
    payload: feedData
  });

  const response = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: { ...feedData, name: "Duplicate Feed" }
  });

  expect(response.statusCode).toBe(409);
  const body = JSON.parse(response.body);
  expect(body.title).toBe("Feed with this URL already exists");
});

test("GET /feeds/:id returns feed by ID", async () => {
  const feedData = {
    name: "TechCrunch",
    url: "https://techcrunch.com/feed/",
    language: "English",
    region: "Global",
    category: "Technology",
    type: "News",
    is_active: true
  };

  const createResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: feedData
  });

  const createdFeed = JSON.parse(createResponse.body);

  const response = await app.inject({
    method: "GET",
    url: `/feeds/${createdFeed.id}`
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body).toMatchObject(feedData);
  expect(body.id).toBe(createdFeed.id);
});

test("GET /feeds/:id returns 404 for non-existent feed", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/feeds/550e8400-e29b-41d4-a716-446655440000"
  });

  expect(response.statusCode).toBe(404);
  const body = JSON.parse(response.body);
  expect(body.title).toBe("Feed not found");
});

test("PUT /feeds/:id updates feed", async () => {
  const feedData = {
    name: "Original Name",
    url: "https://example.com/feed",
    language: "English",
    region: "Global",
    category: "News",
    type: "News",
    is_active: true
  };

  const createResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: feedData
  });

  const createdFeed = JSON.parse(createResponse.body);

  const updateData = {
    name: "Updated Name",
    is_active: false
  };

  const response = await app.inject({
    method: "PUT",
    url: `/feeds/${createdFeed.id}`,
    payload: updateData
  });

  expect(response.statusCode).toBe(200);
  const body = JSON.parse(response.body);
  expect(body.name).toBe("Updated Name");
  expect(body.is_active).toBe(false);
  expect(body.url).toBe(feedData.url);
});

test("DELETE /feeds/:id deletes feed", async () => {
  const feedData = {
    name: "To Delete",
    url: "https://example.com/delete",
    language: "English",
    region: "Global",
    category: "News",
    type: "News",
    is_active: true
  };

  const createResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: feedData
  });

  const createdFeed = JSON.parse(createResponse.body);

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/feeds/${createdFeed.id}`
  });

  expect(deleteResponse.statusCode).toBe(204);

  const getResponse = await app.inject({
    method: "GET",
    url: `/feeds/${createdFeed.id}`
  });

  expect(getResponse.statusCode).toBe(404);
});

test("GET /feeds with pagination", async () => {
  // First clear any existing feeds to ensure exact count
  const db = getDatabase();
  await db.run("DELETE FROM feeds");
  
  for (let i = 0; i < 25; i++) {
    await app.inject({
      method: "POST",
      url: "/feeds",
      payload: {
        name: `Feed ${i}`,
        url: `https://example.com/feed${i}`,
        language: "English",
        region: "Global",
        category: "News",
        type: "News",
        is_active: true
      }
    });
  }

  const response = await app.inject({
    method: "GET",
    url: "/feeds?page=2&limit=10"
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