import { EnhancedDatabaseService } from './enhanced-database.js';
import { healthConfig } from '../config/environment.js';
import { ErrorHandler } from '../utils/errors.js';
import type { 
  FeedInstance, 
  FeedSource, 
  RefreshTier, 
  LanguageCode, 
  ContentCategory,
  HealthCheckResponse 
} from '../api/schemas/enhanced-schemas.js';

/**
 * Health Monitoring and Analytics Service
 * Provides comprehensive monitoring, alerting, and performance analytics
 */

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  score: number; // 0-1
  issues: string[];
  recommendations: string[];
}

interface FeedHealthSummary {
  total_feeds: number;
  active_feeds: number;
  healthy_feeds: number;
  degraded_feeds: number;
  failed_feeds: number;
  avg_reliability_score: number;
  avg_response_time: number;
  total_articles_24h: number;
  new_articles_24h: number;
}

interface TranslationHealthSummary {
  total_jobs_24h: number;
  completed_jobs_24h: number;
  failed_jobs_24h: number;
  avg_quality_score: number;
  avg_processing_time: number;
  queue_backlog: number;
  languages_health: Record<LanguageCode, {
    success_rate: number;
    avg_quality: number;
    processing_time: number;
  }>;
}

interface PerformanceMetrics {
  feed_performance: {
    by_tier: Record<RefreshTier, {
      feeds_count: number;
      avg_reliability: number;
      articles_per_hour: number;
      success_rate: number;
    }>;
    by_language: Record<LanguageCode, {
      feeds_count: number;
      articles_per_hour: number;
      quality_score: number;
    }>;
    by_category: Record<ContentCategory, {
      feeds_count: number;
      articles_per_hour: number;
      urgency_distribution: Record<string, number>;
    }>;
  };
  translation_performance: {
    throughput: number; // translations per hour
    quality_trend: Array<{ date: string; avg_quality: number }>;
    language_pairs: Record<string, {
      volume: number;
      success_rate: number;
      avg_quality: number;
    }>;
  };
}

interface Alert {
  id: string;
  type: 'feed_failure' | 'translation_backlog' | 'quality_degradation' | 'system_performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  feed_id?: string;
  language?: LanguageCode;
  created_at: string;
  resolved: boolean;
}

export class HealthAnalyticsService {
  private db: EnhancedDatabaseService;
  private alertHistory: Alert[] = [];
  private lastHealthCheck: Date = new Date(0);
  private readonly healthCheckInterval = 5 * 60 * 1000; // 5 minutes

  // Thresholds for health assessment
  private readonly HEALTH_THRESHOLDS = {
    feed_reliability_critical: 0.3,
    feed_reliability_degraded: 0.7,
    translation_quality_critical: 0.5,
    translation_quality_degraded: 0.75,
    response_time_critical: 10000, // 10 seconds
    response_time_degraded: 5000,  // 5 seconds
    queue_backlog_critical: 1000,
    queue_backlog_degraded: 200,
    failure_rate_critical: 0.5,
    failure_rate_degraded: 0.2
  };

  constructor(databaseService: EnhancedDatabaseService) {
    this.db = databaseService;
  }

  /**
   * Perform comprehensive system health check
   */
  async performHealthCheck(): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    
    try {
      // Run parallel health checks
      const [
        feedHealth,
        translationHealth,
        systemMetrics
      ] = await Promise.all([
        this.checkFeedHealth(),
        this.checkTranslationHealth(),
        this.getSystemMetrics()
      ]);

      // Calculate overall health status
      const overallHealth = this.calculateOverallHealth(feedHealth, translationHealth);
      
      // Generate alerts based on health status
      await this.generateHealthAlerts(feedHealth, translationHealth);

      const uptime = Date.now() - startTime;
      this.lastHealthCheck = new Date();

      return {
        status: overallHealth.status,
        database: true, // Database is accessible if we got this far
        feeds: {
          total: feedHealth.total_feeds,
          active: feedHealth.active_feeds,
          healthy: feedHealth.healthy_feeds
        },
        translations: {
          queued: translationHealth.queue_backlog,
          processing: 0, // Would need additional query
          avg_quality: translationHealth.avg_quality_score
        },
        uptime: uptime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        database: false,
        feeds: { total: 0, active: 0, healthy: 0 },
        translations: { queued: 0, processing: 0, avg_quality: 0 },
        uptime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check feed health status
   */
  private async checkFeedHealth(): Promise<FeedHealthSummary> {
    const [
      feedPerformance,
      dailyOverview
    ] = await Promise.all([
      this.db.getFeedPerformanceSummary(),
      this.db.getDailyPerformanceOverview(1)
    ]);

    const totalFeeds = feedPerformance.length;
    const activeFeeds = feedPerformance.filter(f => f.reliability_score > 0).length;
    const healthyFeeds = feedPerformance.filter(f => 
      f.reliability_score >= this.HEALTH_THRESHOLDS.feed_reliability_degraded
    ).length;
    const degradedFeeds = feedPerformance.filter(f => 
      f.reliability_score >= this.HEALTH_THRESHOLDS.feed_reliability_critical &&
      f.reliability_score < this.HEALTH_THRESHOLDS.feed_reliability_degraded
    ).length;
    const failedFeeds = feedPerformance.filter(f => 
      f.reliability_score < this.HEALTH_THRESHOLDS.feed_reliability_critical
    ).length;

    const avgReliability = feedPerformance.length > 0
      ? feedPerformance.reduce((sum, f) => sum + f.reliability_score, 0) / feedPerformance.length
      : 0;

    const avgResponseTime = feedPerformance.length > 0
      ? feedPerformance
          .filter(f => f.avg_response_time !== null)
          .reduce((sum, f) => sum + (f.avg_response_time || 0), 0) / 
        feedPerformance.filter(f => f.avg_response_time !== null).length
      : 0;

    const todayStats = dailyOverview[0] || {};

    return {
      total_feeds: totalFeeds,
      active_feeds: activeFeeds,
      healthy_feeds: healthyFeeds,
      degraded_feeds: degradedFeeds,
      failed_feeds: failedFeeds,
      avg_reliability_score: avgReliability,
      avg_response_time: avgResponseTime,
      total_articles_24h: todayStats.total_articles_found || 0,
      new_articles_24h: todayStats.total_new_articles || 0
    };
  }

  /**
   * Check translation health status
   */
  private async checkTranslationHealth(): Promise<TranslationHealthSummary> {
    const [
      translationMetrics,
      queuedJobs
    ] = await Promise.all([
      this.db.getTranslationQualityMetrics(1),
      this.db.getQueuedTranslationJobs(1000)
    ]);

    // Get language-specific health (simplified for now)
    const languagesHealth: Record<LanguageCode, any> = {
      'en': { success_rate: 0.95, avg_quality: 0.85, processing_time: 30 },
      'es': { success_rate: 0.92, avg_quality: 0.82, processing_time: 35 },
      'ar': { success_rate: 0.88, avg_quality: 0.78, processing_time: 45 },
      'pt': { success_rate: 0.90, avg_quality: 0.80, processing_time: 40 },
      'fr': { success_rate: 0.91, avg_quality: 0.81, processing_time: 38 },
      'zh': { success_rate: 0.85, avg_quality: 0.75, processing_time: 55 },
      'ja': { success_rate: 0.86, avg_quality: 0.76, processing_time: 52 }
    };

    return {
      total_jobs_24h: translationMetrics?.total_translations || 0,
      completed_jobs_24h: translationMetrics?.high_quality_count || 0,
      failed_jobs_24h: 0, // Would need additional query
      avg_quality_score: translationMetrics?.avg_quality || 0,
      avg_processing_time: 0, // Would need additional metrics
      queue_backlog: queuedJobs.length,
      languages_health: languagesHealth
    };
  }

  /**
   * Get detailed performance metrics
   */
  async getPerformanceMetrics(days: number = 7): Promise<PerformanceMetrics> {
    const [
      feedPerformance,
      translationPipeline,
      dailyOverview
    ] = await Promise.all([
      this.db.getFeedPerformanceSummary(),
      this.db.getTranslationPipelineStatus(),
      this.db.getDailyPerformanceOverview(days)
    ]);

    // Aggregate feed performance by tier
    const feedsByTier: Record<RefreshTier, any> = {
      'realtime': { feeds_count: 0, avg_reliability: 0, articles_per_hour: 0, success_rate: 0 },
      'frequent': { feeds_count: 0, avg_reliability: 0, articles_per_hour: 0, success_rate: 0 },
      'standard': { feeds_count: 0, avg_reliability: 0, articles_per_hour: 0, success_rate: 0 },
      'slow': { feeds_count: 0, avg_reliability: 0, articles_per_hour: 0, success_rate: 0 }
    };

    feedPerformance.forEach(feed => {
      const tier = feed.refresh_tier as RefreshTier;
      if (feedsByTier[tier]) {
        feedsByTier[tier].feeds_count++;
        feedsByTier[tier].avg_reliability += feed.reliability_score;
        feedsByTier[tier].articles_per_hour += feed.total_articles_24h / 24;
        feedsByTier[tier].success_rate += feed.reliability_score > 0.8 ? 1 : 0;
      }
    });

    // Calculate averages
    Object.values(feedsByTier).forEach(tier => {
      if (tier.feeds_count > 0) {
        tier.avg_reliability /= tier.feeds_count;
        tier.articles_per_hour /= tier.feeds_count;
        tier.success_rate /= tier.feeds_count;
      }
    });

    // Aggregate by language
    const feedsByLanguage: Record<LanguageCode, any> = {
      'en': { feeds_count: 0, articles_per_hour: 0, quality_score: 0 },
      'es': { feeds_count: 0, articles_per_hour: 0, quality_score: 0 },
      'ar': { feeds_count: 0, articles_per_hour: 0, quality_score: 0 },
      'pt': { feeds_count: 0, articles_per_hour: 0, quality_score: 0 },
      'fr': { feeds_count: 0, articles_per_hour: 0, quality_score: 0 },
      'zh': { feeds_count: 0, articles_per_hour: 0, quality_score: 0 },
      'ja': { feeds_count: 0, articles_per_hour: 0, quality_score: 0 }
    };

    feedPerformance.forEach(feed => {
      const lang = feed.source_language as LanguageCode;
      if (feedsByLanguage[lang]) {
        feedsByLanguage[lang].feeds_count++;
        feedsByLanguage[lang].articles_per_hour += feed.total_articles_24h / 24;
        feedsByLanguage[lang].quality_score += feed.high_quality_articles / Math.max(feed.total_articles_24h, 1);
      }
    });

    // Aggregate by category
    const feedsByCategory: Record<ContentCategory, any> = {
      'finance': { feeds_count: 0, articles_per_hour: 0, urgency_distribution: {} },
      'tech': { feeds_count: 0, articles_per_hour: 0, urgency_distribution: {} },
      'health': { feeds_count: 0, articles_per_hour: 0, urgency_distribution: {} },
      'general': { feeds_count: 0, articles_per_hour: 0, urgency_distribution: {} }
    };

    feedPerformance.forEach(feed => {
      const category = feed.content_category as ContentCategory;
      if (feedsByCategory[category]) {
        feedsByCategory[category].feeds_count++;
        feedsByCategory[category].articles_per_hour += feed.total_articles_24h / 24;
      }
    });

    // Quality trend (simplified)
    const qualityTrend = dailyOverview.slice(0, 7).map(day => ({
      date: day.date,
      avg_quality: 0.8 + (Math.random() - 0.5) * 0.2 // Placeholder
    }));

    return {
      feed_performance: {
        by_tier: feedsByTier,
        by_language: feedsByLanguage,
        by_category: feedsByCategory
      },
      translation_performance: {
        throughput: 50, // Placeholder
        quality_trend: qualityTrend,
        language_pairs: {
          'en->es': { volume: 100, success_rate: 0.95, avg_quality: 0.85 },
          'en->ar': { volume: 80, success_rate: 0.88, avg_quality: 0.78 },
          'es->en': { volume: 60, success_rate: 0.92, avg_quality: 0.82 }
          // Add more pairs as needed
        }
      }
    };
  }

  /**
   * Generate health-based alerts
   */
  private async generateHealthAlerts(
    feedHealth: FeedHealthSummary,
    translationHealth: TranslationHealthSummary
  ): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // Feed reliability alerts
    if (feedHealth.avg_reliability_score < this.HEALTH_THRESHOLDS.feed_reliability_critical) {
      alerts.push({
        id: `feed_reliability_${Date.now()}`,
        type: 'feed_failure',
        severity: 'critical',
        title: 'Critical Feed Reliability Issue',
        message: `Average feed reliability is critically low: ${(feedHealth.avg_reliability_score * 100).toFixed(1)}%`,
        created_at: new Date().toISOString(),
        resolved: false
      });
    } else if (feedHealth.avg_reliability_score < this.HEALTH_THRESHOLDS.feed_reliability_degraded) {
      alerts.push({
        id: `feed_reliability_${Date.now()}`,
        type: 'feed_failure',
        severity: 'medium',
        title: 'Feed Reliability Degraded',
        message: `Average feed reliability is below threshold: ${(feedHealth.avg_reliability_score * 100).toFixed(1)}%`,
        created_at: new Date().toISOString(),
        resolved: false
      });
    }

    // Translation quality alerts
    if (translationHealth.avg_quality_score < this.HEALTH_THRESHOLDS.translation_quality_critical) {
      alerts.push({
        id: `translation_quality_${Date.now()}`,
        type: 'quality_degradation',
        severity: 'critical',
        title: 'Critical Translation Quality Issue',
        message: `Average translation quality is critically low: ${(translationHealth.avg_quality_score * 100).toFixed(1)}%`,
        created_at: new Date().toISOString(),
        resolved: false
      });
    }

    // Queue backlog alerts
    if (translationHealth.queue_backlog > this.HEALTH_THRESHOLDS.queue_backlog_critical) {
      alerts.push({
        id: `queue_backlog_${Date.now()}`,
        type: 'translation_backlog',
        severity: 'high',
        title: 'Translation Queue Severely Backlogged',
        message: `Translation queue has ${translationHealth.queue_backlog} pending jobs`,
        created_at: new Date().toISOString(),
        resolved: false
      });
    } else if (translationHealth.queue_backlog > this.HEALTH_THRESHOLDS.queue_backlog_degraded) {
      alerts.push({
        id: `queue_backlog_${Date.now()}`,
        type: 'translation_backlog',
        severity: 'medium',
        title: 'Translation Queue Backlogged',
        message: `Translation queue has ${translationHealth.queue_backlog} pending jobs`,
        created_at: new Date().toISOString(),
        resolved: false
      });
    }

    // Response time alerts
    if (feedHealth.avg_response_time > this.HEALTH_THRESHOLDS.response_time_critical) {
      alerts.push({
        id: `response_time_${Date.now()}`,
        type: 'system_performance',
        severity: 'high',
        title: 'High Feed Response Times',
        message: `Average response time is ${feedHealth.avg_response_time.toFixed(0)}ms`,
        created_at: new Date().toISOString(),
        resolved: false
      });
    }

    // Store alerts in history
    this.alertHistory.push(...alerts);
    
    // Keep only recent alerts (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.alertHistory = this.alertHistory.filter(
      alert => new Date(alert.created_at).getTime() > oneDayAgo
    );

    return alerts;
  }

  /**
   * Calculate overall system health
   */
  private calculateOverallHealth(
    feedHealth: FeedHealthSummary,
    translationHealth: TranslationHealthSummary
  ): SystemHealth {
    let score = 1.0;
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Feed health impact (50% of score)
    const feedScore = feedHealth.avg_reliability_score * 0.5;
    score *= (0.5 + feedScore);

    if (feedHealth.failed_feeds > feedHealth.total_feeds * 0.2) {
      issues.push(`${feedHealth.failed_feeds} feeds are failing`);
      recommendations.push('Review and fix failed feeds');
    }

    if (feedHealth.avg_response_time > this.HEALTH_THRESHOLDS.response_time_degraded) {
      issues.push('High feed response times');
      recommendations.push('Optimize feed processing or reduce frequency');
    }

    // Translation health impact (30% of score)
    if (translationHealth.avg_quality_score > 0) {
      const translationScore = translationHealth.avg_quality_score * 0.3;
      score *= (0.7 + translationScore);
    }

    if (translationHealth.queue_backlog > this.HEALTH_THRESHOLDS.queue_backlog_degraded) {
      issues.push('Translation queue backlog');
      recommendations.push('Increase translation processing capacity');
    }

    // Activity health impact (20% of score)
    if (feedHealth.new_articles_24h < feedHealth.total_feeds * 5) {
      issues.push('Low article discovery rate');
      recommendations.push('Review feed sources and refresh frequencies');
    }

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (score >= 0.8) {
      status = 'healthy';
    } else if (score >= 0.5) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, score, issues, recommendations };
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(hours: number = 24): Promise<Alert[]> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.alertHistory.filter(
      alert => new Date(alert.created_at).getTime() > cutoff
    );
  }

  /**
   * Get system status summary
   */
  async getSystemStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    uptime: number;
    last_check: string;
    active_alerts: number;
    performance_score: number;
  }> {
    // If health check is stale, perform a quick one
    if (Date.now() - this.lastHealthCheck.getTime() > this.healthCheckInterval) {
      await this.performHealthCheck();
    }

    const recentAlerts = await this.getRecentAlerts();
    const activeAlerts = recentAlerts.filter(alert => !alert.resolved);

    return {
      status: activeAlerts.length === 0 ? 'healthy' : 
             activeAlerts.some(a => a.severity === 'critical') ? 'unhealthy' : 'degraded',
      uptime: Date.now() - this.lastHealthCheck.getTime(),
      last_check: this.lastHealthCheck.toISOString(),
      active_alerts: activeAlerts.length,
      performance_score: 0.85 // Would calculate based on recent metrics
    };
  }

  /**
   * Run maintenance and cleanup tasks
   */
  async runMaintenance(): Promise<{
    alerts_cleaned: number;
    recommendations: string[];
  }> {
    // Clean up old alerts
    const initialAlertCount = this.alertHistory.length;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.alertHistory = this.alertHistory.filter(
      alert => new Date(alert.created_at).getTime() > oneDayAgo
    );

    // Get system recommendations
    const healthCheck = await this.performHealthCheck();
    const recommendations = [
      'Regular health monitoring is active',
      'Consider implementing automated feed recovery',
      'Monitor translation quality trends'
    ];

    return {
      alerts_cleaned: initialAlertCount - this.alertHistory.length,
      recommendations
    };
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private getSystemMetrics(): Promise<any> {
    // Placeholder for system-level metrics (CPU, memory, etc.)
    return Promise.resolve({
      cpu_usage: 0.3,
      memory_usage: 0.6,
      disk_usage: 0.4
    });
  }
}