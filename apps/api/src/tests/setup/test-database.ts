import { DatabaseConnection } from '../../database/connection.js';
import fs from 'fs';
import path from 'path';

export class TestDatabase {
  private testDbPath: string;
  private connection: DatabaseConnection | null = null;

  constructor() {
    // Create unique test database for each test run
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.testDbPath = path.join(process.cwd(), 'test-data', `test-${timestamp}.db`);
    
    // Ensure test-data directory exists
    const testDataDir = path.dirname(this.testDbPath);
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
  }

  async setup(): Promise<DatabaseConnection> {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = this.testDbPath;

    // Initialize test database with schema
    const { initializeDatabase } = await import('../../database/init.js');
    const { getDatabase } = await import('../../database/connection.js');
    
    await initializeDatabase();
    
    this.connection = getDatabase();
    
    if (!this.connection) {
      throw new Error('Failed to initialize test database connection');
    }
    
    // Insert test data
    await this.insertTestData();
    
    return this.connection;
  }

  async insertTestData(): Promise<void> {
    if (!this.connection) throw new Error('Database not initialized');

    // Insert test feeds
    const testFeeds = [
      {
        id: 'test-feed-1',
        name: 'Test Feed 1',
        url: 'https://example.com/feed1.xml',
        language: 'en',
        region: 'US',
        category: 'technology',
        type: 'news',
        description: 'Test feed for technology news',
        is_active: 1,
        created_at: '2025-01-01T10:00:00.000Z',
        updated_at: '2025-01-01T10:00:00.000Z'
      },
      {
        id: 'test-feed-2',
        name: 'Test Feed 2',
        url: 'https://example.com/feed2.xml',
        language: 'en',
        region: 'EU',
        category: 'business',
        type: 'news',
        description: 'Test feed for business news',
        is_active: 1,
        created_at: '2025-01-01T11:00:00.000Z',
        updated_at: '2025-01-01T11:00:00.000Z'
      }
    ];

    for (const feed of testFeeds) {
      await this.connection.run(
        `INSERT INTO feeds (id, name, url, language, region, category, type, description, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [feed.id, feed.name, feed.url, feed.language, feed.region, feed.category, feed.type, feed.description, feed.is_active, feed.created_at, feed.updated_at]
      );
    }

    // Insert test articles
    const testArticles = [
      {
        id: 'test-article-1',
        feed_id: 'test-feed-1',
        title: 'Test Technology Article',
        description: 'A test article about technology',
        content: '<p>This is a test article about technology.</p>',
        url: 'https://example.com/article1',
        published_at: '2025-01-01T12:00:00.000Z',
        scraped_at: '2025-01-01T12:05:00.000Z',
        created_at: '2025-01-01T12:05:00.000Z',
        detected_language: 'en',
        needs_manual_language_review: 0
      },
      {
        id: 'test-article-2',
        feed_id: 'test-feed-2',
        title: 'Test Business Article',
        description: 'A test article about business',
        content: '<p>This is a test article about business.</p>',
        url: 'https://example.com/article2',
        published_at: '2025-01-01T13:00:00.000Z',
        scraped_at: '2025-01-01T13:05:00.000Z',
        created_at: '2025-01-01T13:05:00.000Z',
        detected_language: 'en',
        needs_manual_language_review: 0
      }
    ];

    for (const article of testArticles) {
      await this.connection.run(
        `INSERT INTO articles (id, feed_id, title, description, content, url, published_at, scraped_at, created_at, detected_language, needs_manual_language_review)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [article.id, article.feed_id, article.title, article.description, article.content, article.url, article.published_at, article.scraped_at, article.created_at, article.detected_language, article.needs_manual_language_review]
      );
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      // Remove test database file
      if (fs.existsSync(this.testDbPath)) {
        fs.unlinkSync(this.testDbPath);
      }

      // Clean up test-data directory if empty
      const testDataDir = path.dirname(this.testDbPath);
      if (fs.existsSync(testDataDir)) {
        const files = fs.readdirSync(testDataDir);
        if (files.length === 0) {
          fs.rmdirSync(testDataDir);
        }
      }
    } catch (error) {
      console.error('Error during test database cleanup:', error);
    }
  }

  getConnection(): DatabaseConnection | null {
    return this.connection;
  }

  getDbPath(): string {
    return this.testDbPath;
  }
}