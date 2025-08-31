import sqlite3 from 'sqlite3';
import { RSSProvider } from '../providers/rss.js';
import { HealthDatabaseManager } from '../database/health-schema.js';
import { DatabaseService } from './database.js';
import { FeedHealthAnalyzer } from './feed-health-analyzer.js';
import { LanguageDetectionService } from './language-detection.js';
import type { RSSFeed, Language } from '../types/index.js';

/**
 * Configuration for RSS polling
 */
interface PollerConfig {
  intervalMinutes: number;
  maxArticles?: number;
  maxArticleAgeDays?: number; // Skip articles older than this many days
  dbPath?: string;
  mainDbPath?: string; // Path to main database with RSS feeds
  enableHealthTracking?: boolean;
  enableContentExtraction?: boolean; // Extract full article content
  enableLanguageDetection?: boolean; // Detect and update feed languages
  adminNotificationEmail?: string; // For feed failure alerts
}

/**
 * Article record for database storage with comprehensive RSS metadata
 */
interface ArticleRecord {
  // Core article data
  id: string;
  title: string;
  link: string;
  pubDate: string;
  createdAt: string;
  content: string;
  author: string;
  
  // Feed information
  feedId: string;
  feedName: string;
  country: string;
  language: string;
  category: string;
  
  // RSS metadata fields
  guid?: string;
  description?: string;
  contentSnippet?: string;
  isoDate?: string;
  creator?: string;
  summary?: string;
  
  // Media and enclosures
  enclosureUrl?: string;
  enclosureType?: string;
  enclosureLength?: number;
  
  // Categories and tags
  categories?: string; // JSON string of category array
  
  // Source metadata
  source?: string;
  sourceUrl?: string;
  
  // Publication metadata
  published?: string;
  updated?: string;
  
  // Language detection results
  detectedLanguage?: string;
  languageConfidence?: number;
  detectionMethod?: string;
  
  // Content analysis
  wordCount?: number;
  hasImages?: boolean;
  contentExtracted?: boolean;
  extractionSuccess?: boolean;
  
  // Processing metadata
  scrapedAt?: string;
  processedAt?: string;
  httpResponseCode?: number;
  responseTime?: number;
}

/**
 * Simple RSS polling service that monitors feeds for new articles
 */
export class RSSPoller {
  private config: PollerConfig;
  private db: sqlite3.Database;
  private rssProvider: RSSProvider;
  private healthManager?: HealthDatabaseManager;
  private mainDatabase?: DatabaseService;
  private healthAnalyzer?: FeedHealthAnalyzer;
  private languageDetector?: LanguageDetectionService;
  private feedFailureCounts: Map<string, number> = new Map();
  private feedLanguageDetected: Map<string, boolean> = new Map(); // Track which feeds have been language-detected
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;

  constructor(config: PollerConfig) {
    this.config = {
      maxArticles: 1000,
      maxArticleAgeDays: 7, // Skip articles older than 7 days
      dbPath: 'data/rss-poller.db',
      mainDbPath: 'data/articles.db',
      enableHealthTracking: true,
      enableContentExtraction: true,
      enableLanguageDetection: true,
      ...config
    };
    
    this.rssProvider = new RSSProvider();
    this.db = new sqlite3.Database(this.config.dbPath!);
    
    // Initialize main database connection for RSS feeds
    if (this.config.mainDbPath) {
      this.mainDatabase = new DatabaseService();
    }
    
    // Initialize health tracking if enabled
    if (this.config.enableHealthTracking) {
      this.healthManager = new HealthDatabaseManager(this.config.dbPath!);
      this.healthAnalyzer = new FeedHealthAnalyzer(this.config.dbPath!);
    }

    // Initialize language detection if enabled
    if (this.config.enableLanguageDetection) {
      this.languageDetector = new LanguageDetectionService();
    }
  }

  /**
   * Initialize the database and create tables if needed
   */
  async initialize(): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        // Initialize health tables if health tracking is enabled
        if (this.healthManager) {
          await this.healthManager.initializeHealthTables();
        }

        this.db.serialize(() => {
          // First create/migrate the articles table
          this.db.run(`
            CREATE TABLE IF NOT EXISTS articles (
              -- Core article data
              id TEXT PRIMARY KEY,
              title TEXT NOT NULL,
              link TEXT NOT NULL,
              content TEXT,
              author TEXT,
              pubDate TEXT,
              createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
              
              -- Feed information
              feedId TEXT,
              feedName TEXT,
              country TEXT,
              language TEXT,
              category TEXT,
              
              -- RSS metadata fields
              guid TEXT,
              description TEXT,
              contentSnippet TEXT,
              isoDate TEXT,
              creator TEXT,
              summary TEXT,
              
              -- Media and enclosures
              enclosureUrl TEXT,
              enclosureType TEXT,
              enclosureLength INTEGER,
              
              -- Categories and tags
              categories TEXT, -- JSON string of category array
              
              -- Source metadata
              source TEXT,
              sourceUrl TEXT,
              
              -- Publication metadata
              published TEXT,
              updated TEXT,
              
              -- Language detection results
              detectedLanguage TEXT,
              languageConfidence REAL,
              detectionMethod TEXT,
              
              -- Content analysis
              wordCount INTEGER,
              hasImages BOOLEAN DEFAULT FALSE,
              contentExtracted BOOLEAN DEFAULT FALSE,
              extractionSuccess BOOLEAN DEFAULT FALSE,
              
              -- Processing metadata
              scrapedAt TEXT,
              processedAt TEXT,
              httpResponseCode INTEGER DEFAULT 200,
              responseTime INTEGER,
              
              -- Legacy health metrics (kept for compatibility)
              titleLength INTEGER,
              contentLength INTEGER,
              hasAuthor BOOLEAN DEFAULT FALSE,
              hasValidDate BOOLEAN DEFAULT TRUE
            )
          `, (err) => {
            if (err) {
              reject(new Error(`Failed to create articles table: ${err.message}`));
              return;
            }

            // Create feeds table if health tracking enabled
            const createFeedsTable = this.config.enableHealthTracking ? `
              CREATE TABLE IF NOT EXISTS feeds (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                country TEXT NOT NULL,
                language TEXT NOT NULL,
                category TEXT NOT NULL,
                intervalMinutes INTEGER DEFAULT 15,
                isActive BOOLEAN DEFAULT TRUE,
                lastFetched TEXT,
                errorCount INTEGER DEFAULT 0,
                createdAt TEXT DEFAULT CURRENT_TIMESTAMP
              )
            ` : '';

            if (createFeedsTable) {
              this.db.run(createFeedsTable, (feedErr) => {
                if (feedErr) {
                  console.warn(`Warning: Failed to create feeds table: ${feedErr.message}`);
                }
              });
            }

            // Migrate existing table to add new columns if they don't exist
            this.migrateTableSchema(() => {
              // Create indexes for better query performance (after migration)
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(createdAt)`);
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_feed ON articles(feedId, createdAt)`);
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_language ON articles(detectedLanguage)`);
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_pubdate ON articles(pubDate)`);
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category)`);
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_wordcount ON articles(wordCount)`);
              this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_extracted ON articles(contentExtracted)`);
              
              resolve();
            });
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Migrate existing table schema to add new columns
   */
  private migrateTableSchema(callback: () => void): void {
    const newColumns = [
      // RSS metadata fields
      'ADD COLUMN guid TEXT',
      'ADD COLUMN description TEXT',
      'ADD COLUMN contentSnippet TEXT', 
      'ADD COLUMN isoDate TEXT',
      'ADD COLUMN creator TEXT',
      'ADD COLUMN summary TEXT',
      // Media and enclosures
      'ADD COLUMN enclosureUrl TEXT',
      'ADD COLUMN enclosureType TEXT',
      'ADD COLUMN enclosureLength INTEGER',
      // Categories and tags
      'ADD COLUMN categories TEXT',
      // Source metadata
      'ADD COLUMN source TEXT',
      'ADD COLUMN sourceUrl TEXT',
      // Publication metadata
      'ADD COLUMN published TEXT',
      'ADD COLUMN updated TEXT',
      // Language detection results
      'ADD COLUMN detectedLanguage TEXT',
      'ADD COLUMN languageConfidence REAL',
      'ADD COLUMN detectionMethod TEXT',
      // Content analysis
      'ADD COLUMN wordCount INTEGER',
      'ADD COLUMN hasImages BOOLEAN DEFAULT FALSE',
      'ADD COLUMN contentExtracted BOOLEAN DEFAULT FALSE',
      'ADD COLUMN extractionSuccess BOOLEAN DEFAULT FALSE',
      // Processing metadata
      'ADD COLUMN scrapedAt TEXT',
      'ADD COLUMN processedAt TEXT',
      'ADD COLUMN httpResponseCode INTEGER DEFAULT 200',
      'ADD COLUMN responseTime INTEGER'
    ];

    let completed = 0;
    const total = newColumns.length;

    if (total === 0) {
      callback();
      return;
    }

    newColumns.forEach(column => {
      this.db.run(`ALTER TABLE articles ${column}`, (err) => {
        // Ignore errors for columns that already exist
        if (err && !err.message.includes('duplicate column name')) {
          console.warn(`Migration warning: ${err.message}`);
        }
        
        completed++;
        if (completed === total) {
          callback();
        }
      });
    });
  }

  /**
   * Start polling all RSS feeds from database
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('RSS poller is already running');
      return;
    }

    console.log(`🚀 Starting RSS poller for all database feeds`);
    console.log(`📅 Polling interval: ${this.config.intervalMinutes} minutes`);
    
    this.isRunning = true;
    
    // Initial fetch
    await this.pollAllFeeds();
    
    // Set up interval
    this.intervalId = setInterval(async () => {
      if (this.isRunning) {
        await this.pollAllFeeds();
      }
    }, this.config.intervalMinutes * 60 * 1000);
  }

  /**
   * Stop polling
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('RSS poller is not running');
      return;
    }

    console.log('🛑 Stopping RSS poller...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined as any;
    }
  }


  /**
   * Poll all RSS feeds from the database
   */
  private async pollAllFeeds(): Promise<void> {
    try {
      if (!this.mainDatabase) {
        console.log('❌ No main database connection available');
        return;
      }

      // Get all active RSS feeds from database
      const feeds = await this.mainDatabase.getRSSFeeds(true); // activeOnly = true
      const activeFeeds = feeds;
      
      if (activeFeeds.length === 0) {
        console.log('📭 No active RSS feeds found in database');
        return;
      }

      console.log(`\n⏳ Polling ${activeFeeds.length} RSS feeds at ${new Date().toISOString()}...`);
      
      // Process each feed
      for (const feed of activeFeeds) {
        await this.pollSingleFeed(feed);
      }
      
    } catch (error) {
      console.error('❌ Error polling RSS feeds:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Poll a single RSS feed and process new articles
   */
  private async pollSingleFeed(feed: RSSFeed): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;
    let errorMessage: string | undefined;
    let httpStatus = 200;
    let articlesFound = 0;

    try {
      console.log(`📡 Polling: ${feed.name} (${feed.url})`);
      
      const { articles, metadata } = await this.rssProvider.fetchFeed(feed.url);
      console.log(`📰 Found ${articles.length} articles in ${feed.name}`);
      
      articlesFound = articles.length;
      success = true;

      // Perform language detection if enabled and not already done for this feed
      if (this.config.enableLanguageDetection && 
          this.languageDetector && 
          this.mainDatabase && 
          !this.feedLanguageDetected.get(feed.id)) {
        
        await this.performLanguageDetection(feed, metadata, articles);
      }

      let newCount = 0;
      
      for (const article of articles) {
        // Age filtering - skip articles older than configured days
        if (this.isArticleTooOld(article.pubDate)) {
          continue;
        }

        const articleId = this.generateArticleId(article);
        const exists = await this.articleExists(articleId);
        
        if (!exists) {
          const processingStartTime = Date.now();
          let extractedContent = article.content || article.contentSnippet || '';
          let contentExtracted = false;
          let extractionSuccess = false;
          
          // Extract full content if enabled
          if (this.config.enableContentExtraction && article.link) {
            try {
              extractedContent = await this.extractArticleContent(article.link);
              contentExtracted = true;
              extractionSuccess = true;
            } catch (error) {
              console.warn(`⚠️ Failed to extract content for: ${article.title}`);
              contentExtracted = true;
              extractionSuccess = false;
              // Fall back to RSS content
            }
          }

          // Analyze content for metadata
          const wordCount = this.countWords(extractedContent);
          const hasImages = this.detectImages(extractedContent);
          
          // Language detection for this specific article
          let detectedLanguage: string | undefined;
          let languageConfidence: number | undefined;
          let detectionMethod: string | undefined;
          
          if (this.languageDetector) {
            try {
              const langResult = await this.languageDetector.detectFeedLanguage(metadata, [article]);
              detectedLanguage = langResult.detectedLanguage;
              languageConfidence = langResult.confidence;
              detectionMethod = langResult.method;
            } catch (error) {
              // Language detection failed, continue without it
            }
          }

          const processingEndTime = Date.now();
          const processingTime = processingEndTime - processingStartTime;

          const articleRecord: ArticleRecord = {
            // Core article data
            id: articleId,
            title: article.title,
            link: article.link,
            content: extractedContent,
            author: article.author || (article as any).creator || '',
            pubDate: article.pubDate || new Date().toISOString(),
            createdAt: new Date().toISOString(),
            
            // Feed information
            feedId: feed.id,
            feedName: feed.name,
            country: 'Unknown', // Could be extracted from feed metadata if available
            language: feed.language || 'en',
            category: feed.category || 'general',
            
            // RSS metadata fields
            guid: article.guid,
            description: (article as any).description,
            contentSnippet: article.contentSnippet,
            isoDate: (article as any).isoDate,
            creator: (article as any).creator,
            summary: (article as any).summary,
            
            // Media and enclosures
            enclosureUrl: article.enclosure?.url || undefined,
            enclosureType: article.enclosure?.type || undefined,
            enclosureLength: (article.enclosure as any)?.length,
            
            // Categories and tags
            categories: article.categories ? JSON.stringify(article.categories) : undefined,
            
            // Source metadata
            source: (article as any).source,
            sourceUrl: article.link,
            
            // Publication metadata
            published: article.pubDate || (article as any).isoDate,
            updated: (article as any).updated,
            
            // Language detection results
            detectedLanguage,
            languageConfidence,
            detectionMethod,
            
            // Content analysis
            wordCount,
            hasImages,
            contentExtracted,
            extractionSuccess,
            
            // Processing metadata
            scrapedAt: new Date().toISOString(),
            processedAt: new Date().toISOString(),
            httpResponseCode: httpStatus,
            responseTime: processingTime
          };

          await this.insertArticle(articleRecord);
          
          newCount++;
          this.notifyNewArticle(article.title, article.link);
        }
      }

      if (newCount === 0) {
        console.log('✅ No new articles found');
      } else {
        console.log(`🆕 Found ${newCount} new articles`);
      }

      // Update feed last fetched time
      if (this.mainDatabase) {
        await this.mainDatabase.updateRSSFeedLastFetched(feed.id, new Date());
      }

      // Reset failure count on success
      this.feedFailureCounts.delete(feed.id);

      // Clean up old articles if configured
      if (this.config.maxArticles) {
        await this.cleanupOldArticles();
      }

    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
      
      // Determine error type
      if (errorMessage.includes('timeout')) {
        errorType = 'timeout';
      } else if (errorMessage.includes('DNS') || errorMessage.includes('ENOTFOUND')) {
        errorType = 'dns_error';
      } else if (errorMessage.includes('HTTP')) {
        errorType = 'http_error';
        const statusMatch = errorMessage.match(/(\d{3})/);
        if (statusMatch) {
          httpStatus = parseInt(statusMatch[1]);
        }
      } else if (errorMessage.includes('parse') || errorMessage.includes('XML')) {
        errorType = 'parse_error';
      } else {
        errorType = 'unknown_error';
      }

      console.error(`❌ Error polling ${feed.name}:`, errorMessage);

      // Track feed failures and mark as dead if needed
      await this.handleFeedFailure(feed, errorType, errorMessage);
    } finally {
      const responseTime = Date.now() - startTime;

      // Log technical metrics if health tracking enabled
      if (this.healthManager) {
        await this.healthManager.logTechnicalMetrics({
          feedId: feed.id,
          timestamp: new Date().toISOString(),
          responseTime,
          httpStatus,
          success,
          errorType,
          errorMessage,
          contentLength: 0, // Would need to capture actual content length
          encoding: 'utf-8', // Would need to detect actual encoding
          parseTime: 0, // Would need to measure parse time separately
          articlesFound
        });
      }
    }
  }

  /**
   * Generate unique article ID from GUID or link
   */
  private generateArticleId(article: any): string {
    if (article.guid) {
      return article.guid;
    }
    
    // Fallback to link-based hash
    const input = article.link || article.title;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `link-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Check if article already exists in database
   */
  private async articleExists(articleId: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id FROM articles WHERE id = ?',
        [articleId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Insert new article into database with comprehensive metadata
   */
  private async insertArticle(article: ArticleRecord): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO articles (
          -- Core article data
          id, title, link, content, author, pubDate, createdAt,
          -- Feed information
          feedId, feedName, country, language, category,
          -- RSS metadata fields
          guid, description, contentSnippet, isoDate, creator, summary,
          -- Media and enclosures
          enclosureUrl, enclosureType, enclosureLength,
          -- Categories and tags
          categories,
          -- Source metadata
          source, sourceUrl,
          -- Publication metadata
          published, updated,
          -- Language detection results
          detectedLanguage, languageConfidence, detectionMethod,
          -- Content analysis
          wordCount, hasImages, contentExtracted, extractionSuccess,
          -- Processing metadata
          scrapedAt, processedAt, httpResponseCode, responseTime,
          -- Legacy health metrics
          titleLength, contentLength, hasAuthor, hasValidDate
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?,
          ?,
          ?, ?,
          ?, ?,
          ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?
        )
      `;
      
      const values = [
        // Core article data
        article.id,
        article.title,
        article.link,
        article.content || null,
        article.author || null,
        article.pubDate,
        article.createdAt,
        // Feed information
        article.feedId || null,
        article.feedName || null,
        article.country || null,
        article.language || null,
        article.category || null,
        // RSS metadata fields
        article.guid || null,
        article.description || null,
        article.contentSnippet || null,
        article.isoDate || null,
        article.creator || null,
        article.summary || null,
        // Media and enclosures
        article.enclosureUrl || null,
        article.enclosureType || null,
        article.enclosureLength || null,
        // Categories and tags
        article.categories || null,
        // Source metadata
        article.source || null,
        article.sourceUrl || null,
        // Publication metadata
        article.published || null,
        article.updated || null,
        // Language detection results
        article.detectedLanguage || null,
        article.languageConfidence || null,
        article.detectionMethod || null,
        // Content analysis
        article.wordCount || null,
        article.hasImages || false,
        article.contentExtracted || false,
        article.extractionSuccess || false,
        // Processing metadata
        article.scrapedAt || null,
        article.processedAt || null,
        article.httpResponseCode || 200,
        article.responseTime || null,
        // Legacy health metrics
        article.title?.length || 0,
        article.content?.length || 0,
        !!article.author,
        !!article.pubDate
      ];

      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Clean up old articles to maintain database size limit
   */
  private async cleanupOldArticles(): Promise<void> {
    if (!this.config.maxArticles) return;

    return new Promise((resolve, reject) => {
      this.db.run(`
        DELETE FROM articles 
        WHERE id NOT IN (
          SELECT id FROM articles 
          ORDER BY createdAt DESC 
          LIMIT ?
        )
      `, [this.config.maxArticles], function(err) {
        if (err) {
          reject(err);
          return;
        }
        if (this.changes > 0) {
          console.log(`🗑️ Cleaned up ${this.changes} old articles`);
        }
        resolve();
      });
    });
  }

  /**
   * Notify about new article (placeholder for future integrations)
   */
  private notifyNewArticle(title: string, link: string): void {
    console.log(`🆕 NEW: ${title}`);
    console.log(`   📎 ${link}`);
    
    // Placeholder for future notification integrations:
    // - Email notifications
    // - Webhook calls
    // - Push notifications
    // - Slack/Discord messages
  }

  /**
   * Get recent articles from database
   */
  async getRecentArticles(limit: number = 10): Promise<ArticleRecord[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM articles ORDER BY createdAt DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(rows as ArticleRecord[]);
        }
      );
    });
  }

  /**
   * Get total article count
   */
  async getArticleCount(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM articles',
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(row.count);
        }
      );
    });
  }

  /**
   * Check if article is too old based on configuration
   */
  private isArticleTooOld(pubDate?: string): boolean {
    if (!pubDate || !this.config.maxArticleAgeDays) {
      return false;
    }

    const articleDate = new Date(pubDate);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.maxArticleAgeDays);

    return articleDate < cutoffDate;
  }

  /**
   * Extract full article content from URL
   */
  private async extractArticleContent(url: string): Promise<string> {
    try {
      // Simple content extraction - you might want to use a library like readability or mercury
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Basic text extraction (remove HTML tags)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Return first 2000 characters as extracted content
      return textContent.substring(0, 2000);
    } catch (error) {
      throw new Error(`Failed to extract content: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Handle feed failure and mark as dead if necessary
   */
  private async handleFeedFailure(feed: RSSFeed, errorType?: string, errorMessage?: string): Promise<void> {
    const feedId = feed.id;
    const currentFailures = this.feedFailureCounts.get(feedId) || 0;
    const newFailureCount = currentFailures + 1;
    
    this.feedFailureCounts.set(feedId, newFailureCount);

    console.warn(`⚠️ Feed failure ${newFailureCount}/5: ${feed.name}`);

    // Mark feed as dead after 5 consecutive failures
    if (newFailureCount >= 5) {
      console.error(`💀 Marking feed as dead: ${feed.name}`);
      
      if (this.mainDatabase) {
        await this.mainDatabase.toggleRSSFeedStatus(feedId, false); // Mark as inactive
      }

      // Send admin notification
      await this.sendAdminNotification(feed, newFailureCount, errorType, errorMessage);
      
      // Remove from failure tracking since it's now marked as dead
      this.feedFailureCounts.delete(feedId);
    }
  }

  /**
   * Send admin notification for dead feeds
   */
  private async sendAdminNotification(
    feed: RSSFeed, 
    failureCount: number, 
    errorType?: string, 
    errorMessage?: string
  ): Promise<void> {
    const notification = {
      timestamp: new Date().toISOString(),
      feedId: feed.id,
      feedName: feed.name,
      feedUrl: feed.url,
      failureCount,
      errorType,
      errorMessage,
      action: 'MARKED_AS_DEAD'
    };

    // Log notification (in a real app, you'd send email/Slack/etc.)
    console.error('🚨 ADMIN ALERT:', JSON.stringify(notification, null, 2));
    
    if (this.config.adminNotificationEmail) {
      // TODO: Implement actual email notification
      console.log(`📧 Admin notification would be sent to: ${this.config.adminNotificationEmail}`);
    }
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    return new Promise(async (resolve) => {
      this.stop();
      
      // Close health manager if initialized
      if (this.healthManager) {
        await this.healthManager.close();
      }
      
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        }
        resolve();
      });
    });
  }

  /**
   * Helper method to update feed last fetched time
   */
  private async updateFeedLastFetched(feedId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE feeds SET lastFetched = ?, errorCount = 0 WHERE id = ?',
        [new Date().toISOString(), feedId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Helper method to increment feed error count
   */
  private async incrementFeedErrorCount(feedId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE feeds SET errorCount = errorCount + 1 WHERE id = ?',
        [feedId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Count words in text content
   */
  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Detect if content contains images
   */
  private detectImages(content: string): boolean {
    if (!content) return false;
    
    // Check for image tags in HTML content
    const imageRegex = /<img[^>]+>/gi;
    const imageUrls = /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg)/gi;
    
    return imageRegex.test(content) || imageUrls.test(content);
  }

  /**
   * Perform language detection on a feed and update database
   */
  private async performLanguageDetection(
    feed: RSSFeed, 
    metadata: any, 
    articles: any[]
  ): Promise<void> {
    if (!this.languageDetector || !this.mainDatabase) {
      return;
    }

    try {
      console.log(`🌐 Detecting language for: ${feed.name}`);
      
      const result = await this.languageDetector.detectFeedLanguage(metadata, articles);
      
      console.log(`   📝 Detected: ${result.detectedLanguage} (confidence: ${(result.confidence * 100).toFixed(1)}%, method: ${result.method})`);
      
      // Only update if we have reasonable confidence or if method is metadata-based
      if (result.confidence >= 0.6 || result.method === 'metadata') {
        await this.mainDatabase.updateRSSFeedLanguage(feed.id, result.detectedLanguage as Language);
        console.log(`   ✅ Updated ${feed.name} language to: ${result.detectedLanguage}`);
        
        // Mark this feed as language-detected to avoid repeated detection
        this.feedLanguageDetected.set(feed.id, true);
      } else {
        console.log(`   ⚠️ Low confidence (${(result.confidence * 100).toFixed(1)}%), keeping current language: ${feed.language}`);
      }
      
    } catch (error) {
      console.error(`❌ Language detection failed for ${feed.name}:`, error instanceof Error ? error.message : error);
    }
  }
}