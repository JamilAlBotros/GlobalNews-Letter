import sqlite3 from 'sqlite3';

export class HealthDatabaseManager {
  private db: sqlite3.Database;

  constructor(dbPath: string = 'data/rss-poller.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  async initializeHealthTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Enhanced feeds table (if not exists)
        this.db.run(`
          CREATE TABLE IF NOT EXISTS feeds (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            country TEXT NOT NULL,
            language TEXT NOT NULL,
            category TEXT NOT NULL,
            intervalMinutes INTEGER DEFAULT 15,
            isActive BOOLEAN DEFAULT TRUE,
            priority INTEGER DEFAULT 5,
            lastFetched TEXT,
            errorCount INTEGER DEFAULT 0,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Enhanced articles table (if not exists) - add health-related columns
        this.db.run(`
          CREATE TABLE IF NOT EXISTS articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            content TEXT,
            description TEXT,
            author TEXT,
            pubDate TEXT,
            
            -- Geographic & Language
            country TEXT NOT NULL,
            language TEXT NOT NULL,
            originalLanguage TEXT,
            
            -- Classification
            category TEXT NOT NULL,
            feedId TEXT NOT NULL,
            feedName TEXT NOT NULL,
            
            -- Health & Quality Metrics
            titleLength INTEGER,
            contentLength INTEGER,
            hasAuthor BOOLEAN DEFAULT FALSE,
            hasValidDate BOOLEAN DEFAULT TRUE,
            isProcessed BOOLEAN DEFAULT FALSE,
            
            -- Content Quality Indicators
            readabilityScore REAL,
            spellingErrorCount INTEGER DEFAULT 0,
            suspiciousPatterns TEXT, -- JSON array of detected patterns
            
            -- LLM Analysis (when available)
            sentiment REAL,
            sentimentLabel TEXT,
            confidence REAL,
            summary TEXT,
            topics TEXT,
            
            -- Metadata
            relevanceScore REAL DEFAULT 0.5,
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            processedAt TEXT,
            
            FOREIGN KEY (feedId) REFERENCES feeds(id)
          )
        `);

        // Feed health snapshots table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS feed_health_snapshots (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feedId TEXT NOT NULL,
            snapshotDate TEXT NOT NULL,
            
            -- Overall health
            overallHealthScore REAL NOT NULL,
            healthStatus TEXT NOT NULL,
            
            -- Volume metrics
            articlesPerDay REAL,
            articlesPerHour REAL,
            averageFrequency REAL,
            volumeTrend7d REAL,
            volumeTrend30d REAL,
            isVolumeAnomaly BOOLEAN,
            
            -- Quality metrics
            avgTitleLength REAL,
            avgContentLength REAL,
            missingContentPercentage REAL,
            duplicateContentPercentage REAL,
            languageConsistency REAL,
            readabilityScore REAL,
            spellingErrorRate REAL,
            hasAuthorPercentage REAL,
            hasDatePercentage REAL,
            validLinksPercentage REAL,
            
            -- Credibility metrics
            uniqueAuthors INTEGER,
            domainConsistency REAL,
            suspiciousPatternsCount INTEGER,
            unusualPublishingTimes REAL,
            avgAuthenticityScore REAL,
            clickbaitScore REAL,
            biasScore REAL,
            
            -- Technical metrics
            uptime REAL,
            avgResponseTime REAL,
            errorRate REAL,
            parseSuccessRate REAL,
            encodingIssues INTEGER,
            xmlValidityScore REAL,
            timeouts INTEGER,
            dnsErrors INTEGER,
            
            -- Relevance metrics
            sentimentPositive REAL,
            sentimentNeutral REAL,
            sentimentNegative REAL,
            categoryAccuracy REAL,
            topicDiversity REAL,
            avgPublicationDelay REAL,
            breakingNewsDetection REAL,
            staleContentPercentage REAL,
            
            -- Spam detection metrics
            excessiveCapitalization REAL,
            advertisementContent REAL,
            brokenLinksPercentage REAL,
            batchPublishing REAL,
            identicalTimestamps INTEGER,
            
            createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (feedId) REFERENCES feeds(id)
          )
        `);

        // Health alerts table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS health_alerts (
            id TEXT PRIMARY KEY,
            feedId TEXT NOT NULL,
            severity TEXT NOT NULL, -- info, warning, error, critical
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            metadata TEXT, -- JSON for additional data
            timestamp TEXT NOT NULL,
            resolved BOOLEAN DEFAULT FALSE,
            resolvedAt TEXT,
            resolvedBy TEXT,
            
            FOREIGN KEY (feedId) REFERENCES feeds(id)
          )
        `);

        // Technical metrics log table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS feed_technical_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feedId TEXT NOT NULL,
            fetchTimestamp TEXT NOT NULL,
            responseTime INTEGER, -- milliseconds
            httpStatus INTEGER,
            success BOOLEAN NOT NULL,
            errorType TEXT, -- timeout, dns, http_error, parse_error
            errorMessage TEXT,
            contentLength INTEGER,
            encoding TEXT,
            parseTime INTEGER, -- milliseconds to parse RSS
            articlesFound INTEGER,
            
            FOREIGN KEY (feedId) REFERENCES feeds(id)
          )
        `);

        // Suspicious patterns tracking
        this.db.run(`
          CREATE TABLE IF NOT EXISTS suspicious_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feedId TEXT NOT NULL,
            articleId TEXT NOT NULL,
            patternType TEXT NOT NULL, -- duplicate_content, unusual_timing, spam_keywords, etc.
            severity TEXT NOT NULL, -- low, medium, high
            description TEXT NOT NULL,
            evidence TEXT, -- JSON with supporting data
            detectedAt TEXT DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (feedId) REFERENCES feeds(id),
            FOREIGN KEY (articleId) REFERENCES articles(id)
          )
        `);

        // Feed comparison metrics
        this.db.run(`
          CREATE TABLE IF NOT EXISTS feed_comparisons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            feed1Id TEXT NOT NULL,
            feed2Id TEXT NOT NULL,
            comparisonDate TEXT NOT NULL,
            similarityScore REAL, -- 0-100, how similar the feeds are
            duplicateArticles INTEGER, -- articles that appear in both feeds
            qualityDifference REAL, -- quality score difference
            timelinessDifference REAL, -- how much one leads the other
            comparisonData TEXT, -- JSON with detailed comparison
            
            FOREIGN KEY (feed1Id) REFERENCES feeds(id),
            FOREIGN KEY (feed2Id) REFERENCES feeds(id)
          )
        `);

        // Create indexes for performance
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_feed_date ON articles(feedId, createdAt)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_articles_country_category ON articles(country, category)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_health_snapshots_feed_date ON feed_health_snapshots(feedId, snapshotDate)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_alerts_feed_resolved ON health_alerts(feedId, resolved)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_technical_logs_feed_timestamp ON feed_technical_logs(feedId, fetchTimestamp)`);
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_patterns_feed_type ON suspicious_patterns(feedId, patternType)`);

        // Create views for common queries
        this.db.run(`
          CREATE VIEW IF NOT EXISTS feed_health_summary AS
          SELECT 
            f.id,
            f.name,
            f.country,
            f.category,
            f.isActive,
            f.lastFetched,
            f.errorCount,
            s.overallHealthScore,
            s.healthStatus,
            s.snapshotDate as lastHealthCheck,
            COUNT(CASE WHEN a.resolved = 0 THEN 1 END) as activeAlerts
          FROM feeds f
          LEFT JOIN feed_health_snapshots s ON f.id = s.feedId 
            AND s.snapshotDate = (
              SELECT MAX(snapshotDate) 
              FROM feed_health_snapshots s2 
              WHERE s2.feedId = f.id
            )
          LEFT JOIN health_alerts a ON f.id = a.feedId AND a.resolved = 0
          GROUP BY f.id
        `);

        this.db.run(`
          CREATE VIEW IF NOT EXISTS article_quality_summary AS
          SELECT 
            feedId,
            COUNT(*) as totalArticles,
            AVG(titleLength) as avgTitleLength,
            AVG(contentLength) as avgContentLength,
            SUM(CASE WHEN hasAuthor = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as authorPercentage,
            SUM(CASE WHEN readabilityScore > 50 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as readablePercentage,
            AVG(sentiment) as avgSentiment,
            COUNT(DISTINCT author) as uniqueAuthors
          FROM articles 
          WHERE createdAt >= datetime('now', '-7 days')
          GROUP BY feedId
        `);

        resolve();
      });
    });
  }

  // Method to save health snapshot
  async saveHealthSnapshot(snapshot: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO feed_health_snapshots (
          feedId, snapshotDate, overallHealthScore, healthStatus,
          articlesPerDay, articlesPerHour, averageFrequency, volumeTrend7d, volumeTrend30d, isVolumeAnomaly,
          avgTitleLength, avgContentLength, missingContentPercentage, duplicateContentPercentage,
          languageConsistency, readabilityScore, spellingErrorRate, hasAuthorPercentage, hasDatePercentage, validLinksPercentage,
          uniqueAuthors, domainConsistency, suspiciousPatternsCount, unusualPublishingTimes,
          avgAuthenticityScore, clickbaitScore, biasScore,
          uptime, avgResponseTime, errorRate, parseSuccessRate, encodingIssues, xmlValidityScore, timeouts, dnsErrors,
          sentimentPositive, sentimentNeutral, sentimentNegative, categoryAccuracy, topicDiversity,
          avgPublicationDelay, breakingNewsDetection, staleContentPercentage,
          excessiveCapitalization, advertisementContent, brokenLinksPercentage, batchPublishing, identicalTimestamps
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        snapshot.feedId, snapshot.lastAnalyzed.toISOString(), snapshot.overallHealthScore, snapshot.healthStatus,
        // Volume metrics
        snapshot.volume.articlesPerDay, snapshot.volume.articlesPerHour, snapshot.volume.averageFrequency,
        snapshot.volume.volumeTrend7d, snapshot.volume.volumeTrend30d, snapshot.volume.isVolumeAnomaly,
        // Quality metrics
        snapshot.quality.avgTitleLength, snapshot.quality.avgContentLength, 
        snapshot.quality.missingContentPercentage, snapshot.quality.duplicateContentPercentage,
        snapshot.quality.languageConsistency, snapshot.quality.readabilityScore, snapshot.quality.spellingErrorRate,
        snapshot.quality.hasAuthorPercentage, snapshot.quality.hasDatePercentage, snapshot.quality.validLinksPercentage,
        // Credibility metrics
        snapshot.credibility.uniqueAuthors, snapshot.credibility.domainConsistency, 
        snapshot.credibility.suspiciousPatterns?.length || 0, snapshot.credibility.unusualPublishingTimes,
        snapshot.credibility.avgAuthenticityScore, snapshot.credibility.clickbaitScore, snapshot.credibility.biasScore,
        // Technical metrics
        snapshot.technical.uptime, snapshot.technical.avgResponseTime, snapshot.technical.errorRate,
        snapshot.technical.parseSuccessRate, snapshot.technical.encodingIssues, snapshot.technical.xmlValidityScore,
        snapshot.technical.timeouts, snapshot.technical.dnsErrors,
        // Relevance metrics
        snapshot.relevance.sentimentDistribution?.positive || 0, snapshot.relevance.sentimentDistribution?.neutral || 0,
        snapshot.relevance.sentimentDistribution?.negative || 0, snapshot.relevance.categoryAccuracy, 
        snapshot.relevance.topicDiversity, snapshot.relevance.avgPublicationDelay, 
        snapshot.relevance.breakingNewsDetection, snapshot.relevance.staleContentPercentage,
        // Spam metrics
        snapshot.spam.excessiveCapitalization, snapshot.spam.advertisementContent,
        snapshot.spam.brokenLinksPercentage, snapshot.spam.batchPublishing, snapshot.spam.identicalTimestamps
      ], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Method to save health alert
  async saveHealthAlert(alert: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO health_alerts (id, feedId, severity, type, message, metadata, timestamp) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [alert.id, alert.feedId, alert.severity, alert.type, alert.message, 
         JSON.stringify(alert.metadata || {}), alert.timestamp.toISOString()],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Method to log technical metrics
  async logTechnicalMetrics(metrics: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO feed_technical_logs 
         (feedId, fetchTimestamp, responseTime, httpStatus, success, errorType, errorMessage, 
          contentLength, encoding, parseTime, articlesFound) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          metrics.feedId, metrics.timestamp, metrics.responseTime, metrics.httpStatus,
          metrics.success, metrics.errorType, metrics.errorMessage, metrics.contentLength,
          metrics.encoding, metrics.parseTime, metrics.articlesFound
        ],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Method to log suspicious patterns
  async logSuspiciousPattern(pattern: any): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `INSERT INTO suspicious_patterns (feedId, articleId, patternType, severity, description, evidence) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [pattern.feedId, pattern.articleId, pattern.type, pattern.severity, 
         pattern.description, JSON.stringify(pattern.evidence || {})],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Method to get recent health snapshots
  async getRecentHealthSnapshots(feedId: string, limit: number = 10): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM feed_health_snapshots 
         WHERE feedId = ? 
         ORDER BY snapshotDate DESC 
         LIMIT ?`,
        [feedId, limit],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Method to get active alerts
  async getActiveAlerts(feedId?: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const sql = feedId 
        ? `SELECT * FROM health_alerts WHERE feedId = ? AND resolved = 0 ORDER BY timestamp DESC`
        : `SELECT * FROM health_alerts WHERE resolved = 0 ORDER BY timestamp DESC`;
      
      const params = feedId ? [feedId] : [];
      
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // Method to resolve alert
  async resolveAlert(alertId: string, resolvedBy: string = 'system'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE health_alerts 
         SET resolved = 1, resolvedAt = ?, resolvedBy = ? 
         WHERE id = ?`,
        [new Date().toISOString(), resolvedBy, alertId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  // Method to get feed health summary
  async getFeedHealthSummary(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM feed_health_summary ORDER BY overallHealthScore DESC`,
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  // Method to get technical logs
  async getTechnicalLogs(feedId: string, hoursBack: number = 24): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      this.db.all(
        `SELECT * FROM feed_technical_logs 
         WHERE feedId = ? AND fetchTimestamp >= ? 
         ORDER BY fetchTimestamp DESC`,
        [feedId, cutoffDate],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => resolve());
    });
  }
}