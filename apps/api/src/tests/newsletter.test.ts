import { test, expect, beforeAll, afterAll, beforeEach, describe } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import { newsletterRoutes } from "../routes/newsletter.js";
import { articleRoutes } from "../routes/articles.js";
import { feedRoutes } from "../routes/feeds.js";
import { getDatabase, closeDatabase, resetDatabase } from "../database/connection.js";
import { initializeDatabase } from "../database/init.js";
import { NewsletterService } from "../services/newsletter.js";

let app: FastifyInstance;
let testFeedId: string;
let testArticleIds: string[] = [];

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  await resetDatabase();
  
  app = Fastify();
  await app.register(feedRoutes);
  await app.register(articleRoutes);
  await app.register(newsletterRoutes);
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
  testArticleIds = [];

  // Create test feed
  const feedResponse = await app.inject({
    method: "POST",
    url: "/feeds",
    payload: {
      name: "Test News Feed",
      url: "https://example.com/feed",
      language: "English",
      region: "Global",
      category: "News",
      type: "News",
      is_active: true
    }
  });

  const createdFeed = JSON.parse(feedResponse.body);
  testFeedId = createdFeed.id;

  // Create test articles
  const articles = [
    {
      feed_id: testFeedId,
      title: "Breaking: AI Technology Advances",
      description: "Latest developments in artificial intelligence",
      content: "<p>Comprehensive coverage of AI technology breakthroughs</p>",
      url: "https://example.com/ai-tech",
      published_at: "2024-01-01T12:00:00Z",
      detected_language: "english",
      needs_manual_language_review: false
    },
    {
      feed_id: testFeedId,
      title: "Climate Change Update",
      description: "New research on global warming effects",
      content: "<p>Scientists report new findings on climate patterns</p>",
      url: "https://example.com/climate",
      published_at: "2024-01-02T12:00:00Z",
      detected_language: "english",
      needs_manual_language_review: false
    },
    {
      feed_id: testFeedId,
      title: "أخبار التكنولوجيا",
      description: "أحدث التطورات في مجال التكنولوجيا",
      content: "<p>تغطية شاملة للتطورات التقنية الحديثة</p>",
      url: "https://example.com/arabic-tech",
      published_at: "2024-01-03T12:00:00Z",
      detected_language: "arabic",
      needs_manual_language_review: false
    }
  ];

  for (const article of articles) {
    const response = await app.inject({
      method: "POST",
      url: "/articles",
      payload: article
    });
    const created = JSON.parse(response.body);
    testArticleIds.push(created.id);
  }
});

describe("Newsletter Service", () => {
  test("generates LTR newsletter with sample data", () => {
    const service = new NewsletterService();
    const html = service.generatePreview('ltr');
    
    expect(html).toContain('Weekly Tech Update');
    expect(html).toContain('Hello, here are the top stories this week...');
    expect(html).toContain('AI cracks financial models');
    expect(html).toContain('color:#00ff00');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  test("generates RTL newsletter with sample data", () => {
    const service = new NewsletterService();
    const html = service.generatePreview('rtl');
    
    expect(html).toContain('Weekly Tech Update');
    expect(html).toContain('Hello, here are the top stories this week...');
    expect(html).toContain('AI cracks financial models');
    expect(html).toContain('color:#00ff00');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  test("detectLanguageDirection returns correct direction", () => {
    const service = new NewsletterService();
    
    // Test with mostly English articles
    const englishArticles = [
      { detected_language: 'english' },
      { detected_language: 'english' },
      { detected_language: 'arabic' }
    ];
    const direction1 = (service as any).detectLanguageDirection(englishArticles);
    expect(direction1).toBe('ltr');

    // Test with mostly Arabic articles
    const arabicArticles = [
      { detected_language: 'arabic' },
      { detected_language: 'arabic' },
      { detected_language: 'english' }
    ];
    const direction2 = (service as any).detectLanguageDirection(arabicArticles);
    expect(direction2).toBe('rtl');
  });
});

describe("Newsletter API Routes", () => {
  test("GET /newsletter/templates returns template information", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/newsletter/templates"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.templates).toHaveLength(2);
    expect(body.templates.map((t: any) => t.name)).toEqual(['ltr', 'rtl']);
    expect(body.supported_languages).toContain('english');
    expect(body.supported_languages).toContain('arabic');
  });

  test("POST /newsletter/preview generates preview newsletter", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/newsletter/preview",
      payload: {
        language: "ltr"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('<html');
    expect(response.body).toContain('Weekly Tech Update');
  });

  test("POST /newsletter/generate creates newsletter from custom data", async () => {
    const newsletterData = {
      title: "Custom Newsletter",
      intro: "Welcome to our custom newsletter",
      articles: [
        {
          url: "https://example.com/article1",
          title: "Custom Article 1",
          description: "Description for article 1"
        },
        {
          url: "https://example.com/article2",
          title: "Custom Article 2"
        }
      ],
      footer: "Custom footer text",
      language: "ltr"
    };

    const response = await app.inject({
      method: "POST",
      url: "/newsletter/generate",
      payload: newsletterData
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('Custom Newsletter');
    expect(response.body).toContain('Welcome to our custom newsletter');
    expect(response.body).toContain('Custom Article 1');
    expect(response.body).toContain('Custom Article 2');
    expect(response.body).toContain('Custom footer text');
  });

  test("POST /newsletter/from-articles generates newsletter from database articles", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/newsletter/from-articles",
      payload: {
        article_ids: [testArticleIds[0], testArticleIds[1]],
        newsletter_title: "Weekly Digest",
        intro: "Here are this week's top stories",
        footer: "Thanks for reading!"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('Weekly Digest');
    expect(response.body).toContain('Here are this week\'s top stories');
    expect(response.body).toContain('Breaking: AI Technology Advances');
    expect(response.body).toContain('Climate Change Update');
    expect(response.body).toContain('Thanks for reading!');
  });

  test("POST /newsletter/from-articles with RTL detection", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/newsletter/from-articles",
      payload: {
        article_ids: [testArticleIds[2], testArticleIds[2]], // Arabic articles
        newsletter_title: "النشرة الأسبوعية",
        intro: "أهم الأخبار هذا الأسبوع"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.body).toContain('النشرة الأسبوعية');
    expect(response.body).toContain('أخبار التكنولوجيا');
  });

  test("GET /newsletter/latest-articles returns recent articles", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/newsletter/latest-articles?limit=5"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.data).toHaveLength(3);
    expect(body.total).toBe(3);
    expect(body.query.limit).toBe(5);
    
    // Check article structure
    expect(body.data[0]).toHaveProperty('id');
    expect(body.data[0]).toHaveProperty('title');
    expect(body.data[0]).toHaveProperty('url');
    expect(body.data[0]).toHaveProperty('detected_language');
    expect(body.data[0]).toHaveProperty('feed_name');
  });

  test("GET /newsletter/latest-articles with language filter", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/newsletter/latest-articles?language=english&limit=10"
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    
    expect(body.data).toHaveLength(2); // Only English articles
    body.data.forEach((article: any) => {
      expect(article.detected_language).toBe('english');
    });
  });

  test("POST /newsletter/from-articles returns 404 for non-existent articles", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/newsletter/from-articles",
      payload: {
        article_ids: ["550e8400-e29b-41d4-a716-446655440000"]
      }
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.title).toBe("No articles found");
  });

  test("POST /newsletter/generate validates required fields", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/newsletter/generate",
      payload: {
        title: "",
        intro: "Test intro"
      }
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.title).toContain("Invalid input");
  });
});