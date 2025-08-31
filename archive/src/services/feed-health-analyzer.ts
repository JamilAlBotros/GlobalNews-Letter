import sqlite3 from 'sqlite3';
import type {
  FeedHealthDashboard,
  VolumeMetrics,
  QualityMetrics,
  CredibilityMetrics,
  TechnicalMetrics,
  RelevanceMetrics,
  SpamDetection,
  LocalizationHealth,
  HealthAlert,
  HealthSnapshot,
  HealthAnalysisConfig,
  SuspiciousPattern,
  TimePattern
} from '../types/health.js';

interface ArticleHealthData {
  id: string;
  title: string;
  content: string;
  link: string;
  author?: string;
  pubDate: string;
  createdAt: string;
  feedId: string;
  country: string;
  language: string;
  category: string;
  sentiment?: number;
}

interface FeedTechnicalData {
  feedId: string;
  responseTime: number;
  httpStatus: number;
  success: boolean;
  error?: string;
  timestamp: string;
}

export class FeedHealthAnalyzer {
  private db: sqlite3.Database;
  
  constructor(dbPath: string = 'data/rss-poller.db') {
    this.db = new sqlite3.Database(dbPath);
  }

  async analyzeFeedHealth(feedId: string, config?: Partial<HealthAnalysisConfig>): Promise<FeedHealthDashboard> {
    const defaultConfig: HealthAnalysisConfig = {
      feedId,
      analyzeVolume: true,
      analyzeQuality: true,
      analyzeCredibility: true,
      analyzeTechnical: true,
      analyzeRelevance: true,
      analyzeSpam: true,
      analyzeLocalization: true,
      volumeThresholds: {
        minArticlesPerDay: 1,
        maxArticlesPerDay: 100,
        anomalyThreshold: 0.5
      },
      qualityThresholds: {
        minTitleLength: 10,
        minContentLength: 100,
        maxDuplicatePercentage: 10,
        minReadabilityScore: 30
      },
      technicalThresholds: {
        minUptime: 95,
        maxErrorRate: 5,
        maxResponseTime: 10000
      }
    };

    const analysisConfig = { ...defaultConfig, ...config };
    
    // Get feed info
    const feedInfo = await this.getFeedInfo(feedId);
    if (!feedInfo) {
      throw new Error(`Feed with ID ${feedId} not found`);
    }

    // Analyze different aspects
    const volume = analysisConfig.analyzeVolume ? await this.analyzeVolume(feedId, analysisConfig.volumeThresholds) : {} as VolumeMetrics;
    const quality = analysisConfig.analyzeQuality ? await this.analyzeQuality(feedId) : {} as QualityMetrics;
    const credibility = analysisConfig.analyzeCredibility ? await this.analyzeCredibility(feedId) : {} as CredibilityMetrics;
    const technical = analysisConfig.analyzeTechnical ? await this.analyzeTechnical(feedId) : {} as TechnicalMetrics;
    const relevance = analysisConfig.analyzeRelevance ? await this.analyzeRelevance(feedId) : {} as RelevanceMetrics;
    const spam = analysisConfig.analyzeSpam ? await this.analyzeSpam(feedId) : {} as SpamDetection;
    const localization = analysisConfig.analyzeLocalization ? await this.analyzeLocalization(feedId, feedInfo.language) : {} as LocalizationHealth;

    // Calculate overall health score
    const overallHealthScore = this.calculateOverallHealth(volume, quality, credibility, technical, relevance);
    const healthStatus = this.getHealthStatus(overallHealthScore);
    
    // Generate alerts
    const alerts = await this.generateAlerts(feedId, { volume, quality, credibility, technical, relevance }, analysisConfig);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(volume, quality, credibility, technical, spam);
    
    // Get historical snapshots
    const last24h = await this.getHistoricalSnapshot(feedId, 24);
    const last7d = await this.getHistoricalSnapshot(feedId, 24 * 7);
    const last30d = await this.getHistoricalSnapshot(feedId, 24 * 30);

    return {
      feedId,
      feedName: feedInfo.name,
      feedUrl: feedInfo.url,
      country: feedInfo.country,
      category: feedInfo.category,
      language: feedInfo.language,
      overallHealthScore,
      healthStatus,
      volume,
      quality,
      credibility,
      technical,
      relevance,
      spam,
      localization,
      alerts,
      recommendations,
      last24h,
      last7d,
      last30d,
      lastAnalyzed: new Date(),
      nextAnalysis: new Date(Date.now() + 60 * 60 * 1000) // Next hour
    };
  }

  private async getFeedInfo(feedId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM feeds WHERE id = ?',
        [feedId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  private async analyzeVolume(feedId: string, thresholds: any): Promise<VolumeMetrics> {
    // Get articles from last 30 days for trend analysis
    const articles = await this.getRecentArticles(feedId, 30 * 24);
    
    if (articles.length === 0) {
      return {
        articlesPerDay: 0,
        articlesPerHour: 0,
        averageFrequency: 0,
        publishingPattern: { peakHours: [], consistencyScore: 0, averageGapMinutes: 0, batchPublishing: false },
        volumeTrend7d: 0,
        volumeTrend30d: 0,
        isVolumeAnomaly: false,
        expectedRange: [0, 0]
      };
    }

    // Calculate daily volume
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const todayArticles = articles.filter(a => new Date(a.createdAt) >= yesterday).length;
    const articlesPerDay = todayArticles;
    const articlesPerHour = articlesPerDay / 24;

    // Calculate average frequency
    const sortedArticles = articles.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let totalGap = 0;
    for (let i = 1; i < sortedArticles.length; i++) {
      const current = sortedArticles[i];
      const previous = sortedArticles[i-1];
      if (current && previous) {
        const gap = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
        totalGap += gap;
      }
    }
    const averageFrequency = sortedArticles.length > 1 ? totalGap / (sortedArticles.length - 1) / (60 * 1000) : 0;

    // Analyze publishing pattern
    const publishingPattern = this.analyzePublishingPattern(articles);
    
    // Calculate trends
    const last7Days = articles.filter(a => {
      const articleDate = new Date(a.createdAt);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return articleDate >= sevenDaysAgo;
    }).length;
    
    const previous7Days = articles.filter(a => {
      const articleDate = new Date(a.createdAt);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return articleDate >= fourteenDaysAgo && articleDate < sevenDaysAgo;
    }).length;

    const volumeTrend7d = previous7Days > 0 ? ((last7Days - previous7Days) / previous7Days) * 100 : 0;
    const volumeTrend30d = articles.length > 0 ? 0 : 0; // Simplified for now

    // Anomaly detection
    const expectedRange: [number, number] = [thresholds.minArticlesPerDay, thresholds.maxArticlesPerDay];
    const isVolumeAnomaly = articlesPerDay < expectedRange[0] || articlesPerDay > expectedRange[1];

    return {
      articlesPerDay,
      articlesPerHour,
      averageFrequency,
      publishingPattern,
      volumeTrend7d,
      volumeTrend30d,
      isVolumeAnomaly,
      expectedRange
    };
  }

  private analyzePublishingPattern(articles: ArticleHealthData[]): TimePattern {
    const hourCounts: number[] = new Array(24).fill(0);
    const gaps: number[] = [];
    let identicalTimestamps = 0;
    const timestampCounts: Record<string, number> = {};

    articles.forEach(article => {
      const date = new Date(article.createdAt);
      const hour = date.getHours();
      if (hourCounts[hour] !== undefined) {
        hourCounts[hour]++;
      }
      
      const timestamp = article.createdAt;
      timestampCounts[timestamp] = (timestampCounts[timestamp] || 0) + 1;
      if (timestampCounts[timestamp]! > 1) {
        identicalTimestamps++;
      }
    });

    // Find peak hours (top 3 hours with most articles)
    const peakHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => item.hour);

    // Calculate consistency score (how evenly distributed across hours)
    const totalArticles = articles.length;
    const expectedPerHour = totalArticles / 24;
    const variance = hourCounts.reduce((sum, count) => sum + Math.pow(count - expectedPerHour, 2), 0) / 24;
    const consistencyScore = Math.max(0, 100 - (variance / expectedPerHour) * 10);

    // Calculate average gap between articles
    const sortedArticles = articles.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    for (let i = 1; i < sortedArticles.length; i++) {
      const current = sortedArticles[i];
      const previous = sortedArticles[i-1];
      if (current && previous) {
        const gap = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
        gaps.push(gap / (60 * 1000)); // Convert to minutes
      }
    }
    const averageGapMinutes = gaps.length > 0 ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;

    // Detect batch publishing (many articles published within short time windows)
    const batchThreshold = 5; // 5 minutes
    let batchCount = 0;
    for (let i = 1; i < sortedArticles.length; i++) {
      const current = sortedArticles[i];
      const previous = sortedArticles[i-1];
      if (!current || !previous) continue;
      
      const gap = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
      if (gap < batchThreshold * 60 * 1000) {
        batchCount++;
      }
    }
    const batchPublishing = batchCount > articles.length * 0.3; // More than 30% are in batches

    return {
      peakHours,
      consistencyScore,
      averageGapMinutes,
      batchPublishing
    };
  }

  private async analyzeQuality(feedId: string): Promise<QualityMetrics> {
    const articles = await this.getRecentArticles(feedId, 7 * 24); // Last 7 days
    
    if (articles.length === 0) {
      return {
        avgTitleLength: 0,
        avgContentLength: 0,
        missingContentPercentage: 100,
        duplicateContentPercentage: 0,
        languageConsistency: 0,
        readabilityScore: 0,
        spellingErrorRate: 0,
        hasAuthorPercentage: 0,
        hasDatePercentage: 0,
        hasDescriptionPercentage: 0,
        validLinksPercentage: 0
      };
    }

    // Calculate basic metrics
    const avgTitleLength = articles.reduce((sum, a) => sum + (a.title?.length || 0), 0) / articles.length;
    const avgContentLength = articles.reduce((sum, a) => sum + (a.content?.length || 0), 0) / articles.length;
    
    const missingContent = articles.filter(a => !a.content || a.content.length < 50).length;
    const missingContentPercentage = (missingContent / articles.length) * 100;
    
    // Detect duplicates (simplified - based on title similarity)
    const duplicates = this.findDuplicateContent(articles);
    const duplicateContentPercentage = (duplicates.length / articles.length) * 100;
    
    // Language consistency (simplified)
    const expectedLanguage = articles[0]?.language || 'en';
    const sameLanguage = articles.filter(a => a.language === expectedLanguage).length;
    const languageConsistency = (sameLanguage / articles.length) * 100;
    
    // Basic readability score (simplified - based on sentence and word length)
    const readabilityScore = this.calculateReadabilityScore(articles);
    
    // Spelling error rate (simplified - count common misspellings)
    const spellingErrorRate = this.calculateSpellingErrorRate(articles);
    
    // Metadata completeness
    const hasAuthor = articles.filter(a => a.author && a.author.length > 0).length;
    const hasAuthorPercentage = (hasAuthor / articles.length) * 100;
    
    const hasDate = articles.filter(a => a.pubDate && a.pubDate.length > 0).length;
    const hasDatePercentage = (hasDate / articles.length) * 100;
    
    const hasDescription = articles.filter(a => a.content && a.content.length > 100).length;
    const hasDescriptionPercentage = (hasDescription / articles.length) * 100;
    
    // Valid links (simplified - check if link returns 200)
    const validLinksPercentage = 90; // Placeholder - would need actual HTTP checks

    return {
      avgTitleLength,
      avgContentLength,
      missingContentPercentage,
      duplicateContentPercentage,
      languageConsistency,
      readabilityScore,
      spellingErrorRate,
      hasAuthorPercentage,
      hasDatePercentage,
      hasDescriptionPercentage,
      validLinksPercentage
    };
  }

  private async analyzeCredibility(feedId: string): Promise<CredibilityMetrics> {
    const articles = await this.getRecentArticles(feedId, 30 * 24); // Last 30 days
    
    if (articles.length === 0) {
      return {
        uniqueAuthors: 0,
        authorDistribution: {},
        domainConsistency: 0,
        suspiciousPatterns: [],
        duplicateAcrossFeeds: 0,
        unusualPublishingTimes: 0,
        avgAuthenticityScore: 0,
        clickbaitScore: 0,
        biasScore: 0
      };
    }

    // Author analysis
    const authors = articles.map(a => a.author).filter(Boolean);
    const uniqueAuthors = new Set(authors).size;
    const authorDistribution: Record<string, number> = {};
    authors.forEach(author => {
      if (author) {
        authorDistribution[author] = (authorDistribution[author] || 0) + 1;
      }
    });

    // Domain consistency (simplified)
    const domains = articles.map(a => {
      try {
        return new URL(a.link).hostname;
      } catch {
        return 'unknown';
      }
    });
    const uniqueDomains = new Set(domains).size;
    const domainConsistency = uniqueDomains <= 3 ? 100 : Math.max(0, 100 - (uniqueDomains - 3) * 10);

    // Detect suspicious patterns
    const suspiciousPatterns = this.detectSuspiciousPatterns(articles);
    
    // Unusual publishing times (articles published between 2 AM and 5 AM)
    const unusualHours = articles.filter(a => {
      const hour = new Date(a.createdAt).getHours();
      return hour >= 2 && hour <= 5;
    }).length;
    const unusualPublishingTimes = (unusualHours / articles.length) * 100;

    // Placeholder scores for LLM-based analysis
    const avgAuthenticityScore = 75; // Would be calculated by LLM
    const clickbaitScore = this.calculateClickbaitScore(articles);
    const biasScore = 0; // Would be calculated by LLM (-1 to 1)

    return {
      uniqueAuthors,
      authorDistribution,
      domainConsistency,
      suspiciousPatterns,
      duplicateAcrossFeeds: 0, // Would need cross-feed comparison
      unusualPublishingTimes,
      avgAuthenticityScore,
      clickbaitScore,
      biasScore
    };
  }

  private async analyzeTechnical(feedId: string): Promise<TechnicalMetrics> {
    // Get technical data from feed fetch logs
    const technicalData = await this.getTechnicalData(feedId, 7 * 24); // Last 7 days
    
    if (technicalData.length === 0) {
      return {
        uptime: 0,
        avgResponseTime: 0,
        errorRate: 100,
        lastSuccessfulFetch: new Date(0),
        parseSuccessRate: 0,
        encodingIssues: 0,
        xmlValidityScore: 0,
        timeouts: 0,
        httpErrors: {},
        dnsErrors: 0
      };
    }

    const successful = technicalData.filter(d => d.success).length;
    const uptime = (successful / technicalData.length) * 100;
    
    const totalResponseTime = technicalData.reduce((sum, d) => sum + d.responseTime, 0);
    const avgResponseTime = totalResponseTime / technicalData.length;
    
    const errorRate = ((technicalData.length - successful) / technicalData.length) * 100;
    
    const lastSuccessfulData = technicalData.filter(d => d.success).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    const lastSuccessfulFetch = lastSuccessfulData ? new Date(lastSuccessfulData.timestamp) : new Date(0);

    // HTTP error distribution
    const httpErrors: Record<number, number> = {};
    technicalData.forEach(d => {
      if (!d.success && d.httpStatus) {
        httpErrors[d.httpStatus] = (httpErrors[d.httpStatus] || 0) + 1;
      }
    });

    // Simplified metrics (would need more detailed logging)
    const parseSuccessRate = uptime; // Simplified assumption
    const encodingIssues = Math.max(0, technicalData.filter(d => d.error?.includes('encoding')).length);
    const xmlValidityScore = uptime; // Simplified
    const timeouts = technicalData.filter(d => d.error?.includes('timeout')).length;
    const dnsErrors = technicalData.filter(d => d.error?.includes('DNS')).length;

    return {
      uptime,
      avgResponseTime,
      errorRate,
      lastSuccessfulFetch,
      parseSuccessRate,
      encodingIssues,
      xmlValidityScore,
      timeouts,
      httpErrors,
      dnsErrors
    };
  }

  private async analyzeRelevance(feedId: string): Promise<RelevanceMetrics> {
    const articles = await this.getRecentArticles(feedId, 7 * 24); // Last 7 days
    
    if (articles.length === 0) {
      return {
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        categoryAccuracy: 0,
        topicDiversity: 0,
        trending: [],
        avgPublicationDelay: 0,
        breakingNewsDetection: 0,
        staleContentPercentage: 0
      };
    }

    // Sentiment distribution
    const sentiments = articles.map(a => a.sentiment).filter(s => s !== undefined);
    const positive = sentiments.filter(s => s! > 0.1).length;
    const negative = sentiments.filter(s => s! < -0.1).length;
    const neutral = sentiments.length - positive - negative;
    
    const sentimentDistribution = {
      positive: sentiments.length > 0 ? (positive / sentiments.length) * 100 : 33,
      neutral: sentiments.length > 0 ? (neutral / sentiments.length) * 100 : 34,
      negative: sentiments.length > 0 ? (negative / sentiments.length) * 100 : 33
    };

    // Topic analysis (simplified)
    const topics = this.extractTopics(articles);
    const topicDiversity = this.calculateTopicDiversity(topics);
    const trending = Object.entries(topics)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic);

    // Publication delay (time between article creation and our fetch)
    const delays = articles.map(a => {
      const pubDate = new Date(a.pubDate);
      const fetchDate = new Date(a.createdAt);
      return (fetchDate.getTime() - pubDate.getTime()) / (60 * 60 * 1000); // Hours
    }).filter(d => d >= 0 && d < 168); // Filter out invalid dates and > 1 week

    const avgPublicationDelay = delays.length > 0 ? delays.reduce((sum, d) => sum + d, 0) / delays.length : 0;

    // Breaking news detection (simplified - articles published within 2 hours)
    const breakingNews = articles.filter(a => {
      const pubDate = new Date(a.pubDate);
      const fetchDate = new Date(a.createdAt);
      const hoursDiff = (fetchDate.getTime() - pubDate.getTime()) / (60 * 60 * 1000);
      return hoursDiff <= 2;
    }).length;
    const breakingNewsDetection = (breakingNews / articles.length) * 100;

    // Stale content (articles older than 24 hours when fetched)
    const staleArticles = articles.filter(a => {
      const pubDate = new Date(a.pubDate);
      const fetchDate = new Date(a.createdAt);
      const hoursDiff = (fetchDate.getTime() - pubDate.getTime()) / (60 * 60 * 1000);
      return hoursDiff > 24;
    }).length;
    const staleContentPercentage = (staleArticles / articles.length) * 100;

    return {
      sentimentDistribution,
      categoryAccuracy: 80, // Placeholder - would need category classification
      topicDiversity,
      trending,
      avgPublicationDelay,
      breakingNewsDetection,
      staleContentPercentage
    };
  }

  private async analyzeSpam(feedId: string): Promise<SpamDetection> {
    const articles = await this.getRecentArticles(feedId, 7 * 24);
    
    if (articles.length === 0) {
      return {
        excessiveCapitalization: 0,
        suspiciousKeywords: [],
        advertisementContent: 0,
        brokenLinksPercentage: 0,
        redirectChains: 0,
        maliciousLinkDetection: 0,
        batchPublishing: 0,
        identicalTimestamps: 0
      };
    }

    // Analyze titles and content for spam indicators
    const spamKeywords = ['FREE', 'CLICK HERE', 'LIMITED TIME', 'URGENT', 'EXCLUSIVE DEAL'];
    const suspiciousKeywords: string[] = [];
    let excessiveCaps = 0;
    let adContent = 0;

    articles.forEach(article => {
      const title = article.title?.toUpperCase() || '';
      const content = article.content?.toUpperCase() || '';
      
      // Check for excessive capitalization
      const capsCount = (title.match(/[A-Z]/g) || []).length;
      if (capsCount > title.length * 0.3) {
        excessiveCaps++;
      }
      
      // Check for spam keywords
      spamKeywords.forEach(keyword => {
        if (title.includes(keyword) || content.includes(keyword)) {
          if (!suspiciousKeywords.includes(keyword)) {
            suspiciousKeywords.push(keyword);
          }
        }
      });
      
      // Check for advertisement content
      if (content.includes('SPONSORED') || content.includes('ADVERTISEMENT') || 
          content.includes('AFFILIATE') || title.includes('AD:')) {
        adContent++;
      }
    });

    const excessiveCapitalization = (excessiveCaps / articles.length) * 100;
    const advertisementContent = (adContent / articles.length) * 100;

    // Analyze publishing patterns for batch publishing
    const timestamps = articles.map(a => a.createdAt);
    // const duplicateTimestamps = new Set(timestamps).size < timestamps.length; // Unused variable
    const identicalTimestamps = timestamps.length - new Set(timestamps).size;
    
    // Detect batch publishing (many articles within 5-minute windows)
    const sortedArticles = articles.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    let batchCount = 0;
    for (let i = 1; i < sortedArticles.length; i++) {
      const current = sortedArticles[i];
      const previous = sortedArticles[i-1];
      if (current && previous) {
        const timeDiff = new Date(current.createdAt).getTime() - new Date(previous.createdAt).getTime();
        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
          batchCount++;
        }
      }
    }
    const batchPublishing = (batchCount / articles.length) * 100;

    return {
      excessiveCapitalization,
      suspiciousKeywords,
      advertisementContent,
      brokenLinksPercentage: 5, // Placeholder - would need link checking
      redirectChains: 2, // Placeholder
      maliciousLinkDetection: 0, // Placeholder
      batchPublishing,
      identicalTimestamps
    };
  }

  private async analyzeLocalization(feedId: string, expectedLanguage: string): Promise<LocalizationHealth> {
    const articles = await this.getRecentArticles(feedId, 7 * 24);
    
    if (articles.length === 0) {
      return {
        expectedLanguage,
        actualLanguageDistribution: {},
        translationQuality: 0,
        culturalRelevance: 0,
        currencyAndUnits: 0
      };
    }

    // Language distribution
    const languageDistribution: Record<string, number> = {};
    articles.forEach(article => {
      const lang = article.language || 'unknown';
      languageDistribution[lang] = (languageDistribution[lang] || 0) + 1;
    });

    // Convert counts to percentages
    const actualLanguageDistribution: Record<string, number> = {};
    Object.entries(languageDistribution).forEach(([lang, count]) => {
      actualLanguageDistribution[lang] = (count / articles.length) * 100;
    });

    // Translation quality (simplified - check for common translation artifacts)
    const translationArtifacts = articles.filter(article => {
      const content = article.content?.toLowerCase() || '';
      return content.includes('translate') || content.includes('google translate') || 
             content.includes('machine translation') || content.includes('[translated]');
    }).length;
    const translationQuality = Math.max(0, 100 - (translationArtifacts / articles.length) * 100);

    // Cultural relevance (placeholder - would need more sophisticated analysis)
    const culturalRelevance = 75;

    // Currency and units (placeholder - would need to detect local vs international units)
    const currencyAndUnits = 70;

    return {
      expectedLanguage,
      actualLanguageDistribution,
      translationQuality,
      culturalRelevance,
      currencyAndUnits
    };
  }

  // Helper methods
  private async getRecentArticles(feedId: string, hoursBack: number): Promise<ArticleHealthData[]> {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
      this.db.all(
        `SELECT * FROM articles 
         WHERE feedId = ? AND createdAt >= ? 
         ORDER BY createdAt DESC`,
        [feedId, cutoffDate],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows as ArticleHealthData[]);
        }
      );
    });
  }

  private async getTechnicalData(feedId: string, hoursBack: number): Promise<FeedTechnicalData[]> {
    // This would come from a separate technical metrics table
    // For now, return mock data based on feed activity
    const articles = await this.getRecentArticles(feedId, hoursBack);
    
    return articles.map((article) => ({
      feedId,
      responseTime: 1000 + Math.random() * 3000,
      httpStatus: Math.random() > 0.05 ? 200 : 404,
      success: Math.random() > 0.05,
      timestamp: article.createdAt,
      error: Math.random() > 0.95 ? 'Connection timeout' : ''
    }) as FeedTechnicalData);
  }

  private findDuplicateContent(articles: ArticleHealthData[]): ArticleHealthData[] {
    const seen = new Set<string>();
    const duplicates: ArticleHealthData[] = [];
    
    articles.forEach(article => {
      const normalized = article.title?.toLowerCase().trim() || '';
      if (seen.has(normalized)) {
        duplicates.push(article);
      } else {
        seen.add(normalized);
      }
    });
    
    return duplicates;
  }

  private calculateReadabilityScore(articles: ArticleHealthData[]): number {
    // Simplified Flesch Reading Ease calculation
    let totalScore = 0;
    let validArticles = 0;

    articles.forEach(article => {
      const content = article.content || '';
      if (content.length < 10) return;

      const sentences = content.split(/[.!?]+/).length;
      const words = content.split(/\s+/).length;
      const syllables = this.countSyllables(content);

      if (sentences > 0 && words > 0) {
        const score = 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
        totalScore += Math.max(0, Math.min(100, score));
        validArticles++;
      }
    });

    return validArticles > 0 ? totalScore / validArticles : 0;
  }

  private countSyllables(text: string): number {
    return text.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[aeiou]{2,}/g, 'a')
      .replace(/[^aeiou]/g, '')
      .length || 1;
  }

  private calculateSpellingErrorRate(articles: ArticleHealthData[]): number {
    // Simplified - look for common misspellings
    const commonMisspellings = ['teh', 'adn', 'hte', 'recieve', 'seperate', 'definately'];
    let totalErrors = 0;
    let totalWords = 0;

    articles.forEach(article => {
      const words = (article.content || '').toLowerCase().split(/\s+/);
      totalWords += words.length;
      
      commonMisspellings.forEach(misspelling => {
        totalErrors += words.filter(word => word.includes(misspelling)).length;
      });
    });

    return totalWords > 0 ? (totalErrors / totalWords) * 100 : 0;
  }

  private detectSuspiciousPatterns(articles: ArticleHealthData[]): SuspiciousPattern[] {
    const patterns: SuspiciousPattern[] = [];
    
    // Detect duplicate content
    const duplicates = this.findDuplicateContent(articles);
    if (duplicates.length > 0) {
      patterns.push({
        type: 'duplicate_content',
        count: duplicates.length,
        severity: duplicates.length > articles.length * 0.2 ? 'high' : 'medium',
        examples: duplicates.slice(0, 3).map(d => d.title || 'Untitled'),
        description: `Found ${duplicates.length} duplicate articles`
      });
    }

    // Detect broken links (simplified)
    const brokenLinks = articles.filter(a => !a.link || a.link.length < 10).length;
    if (brokenLinks > 0) {
      patterns.push({
        type: 'broken_links',
        count: brokenLinks,
        severity: brokenLinks > articles.length * 0.1 ? 'high' : 'low',
        examples: [],
        description: `${brokenLinks} articles with missing or invalid links`
      });
    }

    return patterns;
  }

  private calculateClickbaitScore(articles: ArticleHealthData[]): number {
    const clickbaitWords = ['shocking', 'unbelievable', 'you won\'t believe', 'this will blow your mind', 
                           'doctors hate', 'one weird trick', 'what happens next', 'number 7 will'];
    
    let clickbaitCount = 0;
    articles.forEach(article => {
      const title = article.title?.toLowerCase() || '';
      const hasClickbait = clickbaitWords.some(word => title.includes(word));
      if (hasClickbait) clickbaitCount++;
    });

    return (clickbaitCount / articles.length) * 100;
  }

  private extractTopics(articles: ArticleHealthData[]): Record<string, number> {
    // Simplified topic extraction based on common keywords
    const topics: Record<string, number> = {};
    const topicKeywords = {
      'technology': ['tech', 'ai', 'software', 'digital', 'internet', 'cyber'],
      'politics': ['election', 'government', 'policy', 'congress', 'senate'],
      'health': ['medical', 'doctor', 'patient', 'treatment', 'vaccine'],
      'business': ['company', 'market', 'stock', 'financial', 'economy'],
      'sports': ['game', 'team', 'player', 'championship', 'score'],
      'entertainment': ['movie', 'actor', 'celebrity', 'music', 'show']
    };

    articles.forEach(article => {
      const text = (article.title + ' ' + (article.content || '')).toLowerCase();
      
      Object.entries(topicKeywords).forEach(([topic, keywords]) => {
        const matches = keywords.filter(keyword => text.includes(keyword)).length;
        if (matches > 0) {
          topics[topic] = (topics[topic] || 0) + matches;
        }
      });
    });

    return topics;
  }

  private calculateTopicDiversity(topics: Record<string, number>): number {
    const values = Object.values(topics);
    if (values.length === 0) return 0;
    
    const total = values.reduce((sum, count) => sum + count, 0);
    if (total === 0) return 0;
    
    // Calculate Shannon entropy
    let entropy = 0;
    values.forEach(count => {
      const probability = count / total;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    });
    
    // Normalize to 0-100 scale
    const maxEntropy = Math.log2(values.length);
    return maxEntropy > 0 ? (entropy / maxEntropy) * 100 : 0;
  }

  private calculateOverallHealth(
    volume: Partial<VolumeMetrics>,
    quality: Partial<QualityMetrics>,
    credibility: Partial<CredibilityMetrics>,
    technical: Partial<TechnicalMetrics>,
    relevance: Partial<RelevanceMetrics>
  ): number {
    const weights = {
      volume: 0.2,
      quality: 0.25,
      credibility: 0.2,
      technical: 0.25,
      relevance: 0.1
    };

    const scores = {
      volume: this.calculateVolumeScore(volume),
      quality: this.calculateQualityScore(quality),
      credibility: this.calculateCredibilityScore(credibility),
      technical: this.calculateTechnicalScore(technical),
      relevance: this.calculateRelevanceScore(relevance)
    };

    return Object.entries(weights).reduce((total, [category, weight]) => {
      return total + (scores[category as keyof typeof scores] * weight);
    }, 0);
  }

  private calculateVolumeScore(volume: Partial<VolumeMetrics>): number {
    if (!volume.articlesPerDay) return 0;
    
    let score = 100;
    
    // Penalize if volume is too low or too high
    if (volume.articlesPerDay < 1) score -= 30;
    if (volume.articlesPerDay > 50) score -= 20;
    
    // Bonus for consistent publishing
    if (volume.publishingPattern && volume.publishingPattern.consistencyScore > 70) {
      score += 10;
    }
    
    // Penalize for anomalies
    if (volume.isVolumeAnomaly) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateQualityScore(quality: Partial<QualityMetrics>): number {
    if (!quality.avgTitleLength) return 0;
    
    let score = 100;
    
    // Title length
    if (quality.avgTitleLength < 20) score -= 10;
    if (quality.avgTitleLength > 100) score -= 5;
    
    // Content length
    if (quality.avgContentLength && quality.avgContentLength < 200) score -= 15;
    
    // Missing content
    if (quality.missingContentPercentage && quality.missingContentPercentage > 20) {
      score -= quality.missingContentPercentage;
    }
    
    // Duplicates
    if (quality.duplicateContentPercentage && quality.duplicateContentPercentage > 10) {
      score -= quality.duplicateContentPercentage;
    }
    
    // Metadata completeness
    const metadataScore = (
      (quality.hasAuthorPercentage || 0) +
      (quality.hasDatePercentage || 0) +
      (quality.hasDescriptionPercentage || 0)
    ) / 3;
    score = score * (metadataScore / 100);
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateCredibilityScore(credibility: Partial<CredibilityMetrics>): number {
    let score = 100;
    
    // Author diversity
    if (credibility.uniqueAuthors && credibility.uniqueAuthors < 3) score -= 20;
    
    // Suspicious patterns
    if (credibility.suspiciousPatterns) {
      credibility.suspiciousPatterns.forEach(pattern => {
        switch (pattern.severity) {
          case 'high': score -= 30; break;
          case 'medium': score -= 15; break;
          case 'low': score -= 5; break;
        }
      });
    }
    
    // Clickbait
    if (credibility.clickbaitScore && credibility.clickbaitScore > 20) {
      score -= credibility.clickbaitScore;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateTechnicalScore(technical: Partial<TechnicalMetrics>): number {
    if (!technical.uptime) return 0;
    
    let score = technical.uptime;
    
    // Response time penalty
    if (technical.avgResponseTime && technical.avgResponseTime > 5000) {
      score -= 10;
    }
    
    // Parse success rate
    if (technical.parseSuccessRate && technical.parseSuccessRate < 95) {
      score -= (95 - technical.parseSuccessRate);
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private calculateRelevanceScore(relevance: Partial<RelevanceMetrics>): number {
    let score = 100;
    
    // Topic diversity bonus
    if (relevance.topicDiversity && relevance.topicDiversity > 50) {
      score += 10;
    }
    
    // Stale content penalty
    if (relevance.staleContentPercentage && relevance.staleContentPercentage > 30) {
      score -= relevance.staleContentPercentage / 2;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  private getHealthStatus(score: number): 'excellent' | 'good' | 'warning' | 'critical' | 'down' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 50) return 'warning';
    if (score >= 25) return 'critical';
    return 'down';
  }

  private async generateAlerts(
    feedId: string,
    metrics: any,
    config: HealthAnalysisConfig
  ): Promise<HealthAlert[]> {
    const alerts: HealthAlert[] = [];
    
    // Volume alerts
    if (metrics.volume.isVolumeAnomaly) {
      alerts.push({
        id: `${feedId}-volume-anomaly-${Date.now()}`,
        feedId,
        severity: 'warning',
        type: 'volume_anomaly',
        message: `Unusual article volume detected: ${metrics.volume.articlesPerDay} articles/day`,
        timestamp: new Date(),
        resolved: false
      });
    }
    
    // Quality alerts
    if (metrics.quality.missingContentPercentage > 50) {
      alerts.push({
        id: `${feedId}-quality-content-${Date.now()}`,
        feedId,
        severity: 'error',
        type: 'quality_issue',
        message: `High percentage of articles with missing content: ${metrics.quality.missingContentPercentage.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false
      });
    }
    
    // Technical alerts
    if (metrics.technical.uptime < config.technicalThresholds.minUptime) {
      alerts.push({
        id: `${feedId}-uptime-low-${Date.now()}`,
        feedId,
        severity: 'critical',
        type: 'uptime_issue',
        message: `Low uptime: ${metrics.technical.uptime.toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false
      });
    }
    
    return alerts;
  }

  private generateRecommendations(
    volume: Partial<VolumeMetrics>,
    quality: Partial<QualityMetrics>,
    credibility: Partial<CredibilityMetrics>,
    technical: Partial<TechnicalMetrics>,
    spam: Partial<SpamDetection>
  ): string[] {
    const recommendations: string[] = [];
    
    if (volume.articlesPerDay && volume.articlesPerDay < 1) {
      recommendations.push('Consider finding additional RSS feeds for this category to increase article volume');
    }
    
    if (quality.missingContentPercentage && quality.missingContentPercentage > 30) {
      recommendations.push('Implement content extraction fallback methods for articles with missing content');
    }
    
    if (technical.uptime && technical.uptime < 90) {
      recommendations.push('Monitor feed reliability - consider backup feeds or increase retry attempts');
    }
    
    if (spam.excessiveCapitalization && spam.excessiveCapitalization > 20) {
      recommendations.push('Apply content filtering to reduce low-quality clickbait articles');
    }
    
    if (credibility.suspiciousPatterns && credibility.suspiciousPatterns.length > 0) {
      recommendations.push('Review feed credibility - multiple suspicious patterns detected');
    }
    
    return recommendations;
  }

  private async getHistoricalSnapshot(feedId: string, hoursBack: number): Promise<HealthSnapshot> {
    // This would retrieve historical health data from a snapshots table
    // For now, return a simplified placeholder
    return {
      timestamp: new Date(Date.now() - hoursBack * 60 * 60 * 1000),
      overallHealthScore: 75, // Placeholder
      volume: {},
      quality: {},
      credibility: {},
      technical: {},
      relevance: {}
    };
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.db.close(() => resolve());
    });
  }
}