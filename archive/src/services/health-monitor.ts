import { EnhancedDatabaseService } from './enhanced-database.js';
import { LLMService } from './llm-service.js';
import { RSSProcessor } from './rss-processor.js';
import { TranslationPipeline } from './translation-pipeline.js';
import { AuthService } from './auth-service.js';
import { healthConfig, isDevelopment } from '../config/environment.js';
import { ErrorHandler } from '../utils/errors.js';

/**
 * Comprehensive Health Monitoring Service
 * Monitors all system components and provides health dashboard
 * Simplified for local deployment
 */

export interface SystemHealthStatus {
  overall_status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    database: ComponentHealth;
    feed_processing: ComponentHealth;
    translation_pipeline: ComponentHealth;
    llm_service: ComponentHealth;
    authentication: ComponentHealth;
  };
  metrics: {
    active_feeds: number;
    total_articles: number;
    pending_translations: number;
    system_uptime: string;
    memory_usage?: string;
    disk_usage?: string;
  };
  alerts: Alert[];
  last_updated: string;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  message?: string;
  response_time?: number;
  error_rate?: number;
  last_check: string;
  details?: Record<string, any>;
}

export interface Alert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface PerformanceMetrics {
  feeds: {
    total_feeds: number;
    active_feeds: number;
    avg_fetch_time: number;
    success_rate: number;
    articles_per_day: number;
  };
  translations: {
    queue_size: number;
    completed_today: number;
    avg_quality_score: number;
    avg_processing_time: number;
    success_rate: number;
  };
  system: {
    uptime_hours: number;
    database_size_mb: number;
    total_articles: number;
    total_translations: number;
  };
}

export class HealthMonitor {
  private db: EnhancedDatabaseService;
  private llmService: LLMService;
  private rssProcessor: RSSProcessor;
  private translationPipeline: TranslationPipeline;
  private authService: AuthService;
  private alerts: Alert[] = [];
  private startTime: Date;

  constructor(
    db: EnhancedDatabaseService,
    llmService: LLMService,
    rssProcessor: RSSProcessor,
    translationPipeline: TranslationPipeline,
    authService: AuthService
  ) {
    this.db = db;
    this.llmService = llmService;
    this.rssProcessor = rssProcessor;
    this.translationPipeline = translationPipeline;
    this.authService = authService;
    this.startTime = new Date();
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemHealthStatus> {
    const startTime = Date.now();
    console.log(`[HealthMonitor] Starting comprehensive system health check at ${new Date().toISOString()}`);

    try {
      console.log('[HealthMonitor] Checking all components in parallel...');
      // Check all components in parallel
      const [
        databaseHealth,
        feedHealth,
        translationHealth,
        llmHealth,
        authHealth,
        metrics
      ] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkFeedProcessingHealth(),
        this.checkTranslationPipelineHealth(),
        this.checkLLMHealth(),
        this.checkAuthHealth(),
        this.getSystemMetrics()
      ]);

      console.log(`[HealthMonitor] Component checks completed in ${Date.now() - startTime}ms`);

      const components = {
        database: this.getResultValue(databaseHealth, 'unknown'),
        feed_processing: this.getResultValue(feedHealth, 'unknown'),
        translation_pipeline: this.getResultValue(translationHealth, 'unknown'),
        llm_service: this.getResultValue(llmHealth, 'unknown'),
        authentication: this.getResultValue(authHealth, 'unknown')
      };

      const systemMetrics = this.getResultValue(metrics, {
        active_feeds: 0,
        total_articles: 0,
        pending_translations: 0,
        system_uptime: this.getUptime()
      });

      // Determine overall status
      const overallStatus = this.calculateOverallStatus(components);

      // Update alerts based on component status
      this.updateAlerts(components);

      const result = {
        overall_status: overallStatus,
        components,
        metrics: {
          ...systemMetrics,
          memory_usage: this.getMemoryUsage(),
        },
        alerts: this.alerts.filter(alert => !alert.resolved),
        last_updated: new Date().toISOString()
      };

      console.log(`[HealthMonitor] System health check completed - Overall: ${overallStatus}, Components: ${Object.keys(components).length}, Alerts: ${result.alerts.length}`);
      
      return result;
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'getSystemHealth' });
      
      return {
        overall_status: 'unhealthy',
        components: {
          database: { status: 'unknown', last_check: new Date().toISOString() },
          feed_processing: { status: 'unknown', last_check: new Date().toISOString() },
          translation_pipeline: { status: 'unknown', last_check: new Date().toISOString() },
          llm_service: { status: 'unknown', last_check: new Date().toISOString() },
          authentication: { status: 'unknown', last_check: new Date().toISOString() }
        },
        metrics: {
          active_feeds: 0,
          total_articles: 0,
          pending_translations: 0,
          system_uptime: this.getUptime()
        },
        alerts: [{
          id: Date.now().toString(),
          severity: 'critical',
          component: 'system',
          message: 'Health check failed',
          timestamp: new Date().toISOString(),
          resolved: false
        }],
        last_updated: new Date().toISOString()
      };
    }
  }

  /**
   * Get detailed performance metrics
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const [feedMetrics, translationMetrics, systemMetrics] = await Promise.allSettled([
        this.getFeedMetrics(),
        this.getTranslationMetrics(),
        this.getSystemMetrics()
      ]);

      return {
        feeds: this.getResultValue(feedMetrics, {
          total_feeds: 0,
          active_feeds: 0,
          avg_fetch_time: 0,
          success_rate: 0,
          articles_per_day: 0
        }),
        translations: this.getResultValue(translationMetrics, {
          queue_size: 0,
          completed_today: 0,
          avg_quality_score: 0,
          avg_processing_time: 0,
          success_rate: 0
        }),
        system: this.getResultValue(systemMetrics, {
          uptime_hours: this.getUptimeHours(),
          database_size_mb: 0,
          total_articles: 0,
          total_translations: 0
        })
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'getPerformanceMetrics' });
      throw error;
    }
  }

  /**
   * Component health check methods
   */
  private async checkDatabaseHealth(): Promise<ComponentHealth> {
    const startTime = Date.now();
    console.log('[HealthMonitor] Checking database health...');
    
    try {
      // Simple connectivity and response time test
      await this.db.getFeedSources({ activeOnly: true });
      
      const responseTime = Date.now() - startTime;
      const status = responseTime < 1000 ? 'healthy' : 'degraded';
      
      console.log(`[HealthMonitor] Database check: ${status} (${responseTime}ms)`);
      
      return {
        status,
        message: `Database responsive in ${responseTime}ms`,
        response_time: responseTime,
        last_check: new Date().toISOString(),
        details: {
          wal_mode: true,
          foreign_keys: true
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      console.error(`[HealthMonitor] Database check failed: ${error instanceof Error ? error.message : 'Unknown error'} (${responseTime}ms)`);
      
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database connection failed',
        response_time: responseTime,
        last_check: new Date().toISOString()
      };
    }
  }

  private async checkFeedProcessingHealth(): Promise<ComponentHealth> {
    console.log('[HealthMonitor] Checking RSS processor health...');
    
    try {
      const healthCheck = await this.rssProcessor.healthCheck();
      
      console.log(`[HealthMonitor] RSS processor check: ${healthCheck.status} (${healthCheck.metrics?.totalFeeds || 0} feeds)`);
      
      return {
        status: healthCheck.status,
        message: `Processing ${healthCheck.metrics?.totalFeeds || 0} feeds`,
        response_time: healthCheck.metrics?.avgProcessingTime,
        last_check: new Date().toISOString(),
        details: healthCheck.metrics
      };
    } catch (error) {
      console.error(`[HealthMonitor] RSS processor check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        status: 'unhealthy',
        message: 'RSS processor health check failed',
        last_check: new Date().toISOString()
      };
    }
  }

  private async checkTranslationPipelineHealth(): Promise<ComponentHealth> {
    console.log('[HealthMonitor] Checking translation pipeline health...');
    
    try {
      const metrics = await this.translationPipeline.getQueueMetrics();
      
      const queueBacklog = metrics.queued + metrics.processing;
      const status = queueBacklog > healthConfig.thresholds.maxQueueBacklog ? 'degraded' : 'healthy';
      
      console.log(`[HealthMonitor] Translation pipeline check: ${status} (${queueBacklog} jobs in queue, avg quality: ${metrics.avg_quality_score.toFixed(2)})`);
      
      return {
        status,
        message: `${queueBacklog} jobs in queue, avg quality: ${metrics.avg_quality_score.toFixed(2)}`,
        last_check: new Date().toISOString(),
        details: metrics
      };
    } catch (error) {
      console.error(`[HealthMonitor] Translation pipeline check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        status: 'unhealthy',
        message: 'Translation pipeline health check failed',
        last_check: new Date().toISOString()
      };
    }
  }

  private async checkLLMHealth(): Promise<ComponentHealth> {
    console.log('[HealthMonitor] Checking LLM service health...');
    
    try {
      const healthCheck = await this.llmService.healthCheck();
      
      console.log(`[HealthMonitor] LLM service check: ${healthCheck.status} (${isDevelopment ? 'mock mode' : 'live mode'}, ${healthCheck.responseTimeMs}ms)`);
      
      return {
        status: healthCheck.status,
        message: isDevelopment ? 'Mock LLM service' : 'LLM service operational',
        response_time: healthCheck.responseTimeMs,
        last_check: new Date().toISOString(),
        details: {
          mock_mode: isDevelopment
        }
      };
    } catch (error) {
      console.error(`[HealthMonitor] LLM service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        status: 'degraded',
        message: 'LLM service unavailable (using fallbacks)',
        last_check: new Date().toISOString()
      };
    }
  }

  private async checkAuthHealth(): Promise<ComponentHealth> {
    console.log('[HealthMonitor] Checking authentication service health...');
    
    try {
      const healthCheck = this.authService.healthCheck();
      
      console.log(`[HealthMonitor] Auth service check: ${healthCheck.status} (${isDevelopment ? 'auth skipped' : 'auth enforced'})`);
      
      return {
        status: healthCheck.status,
        message: healthCheck.message || 'Authentication service operational',
        last_check: new Date().toISOString(),
        details: {
          skip_auth: isDevelopment
        }
      };
    } catch (error) {
      console.error(`[HealthMonitor] Auth service check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        status: 'unhealthy',
        message: 'Authentication service failed',
        last_check: new Date().toISOString()
      };
    }
  }

  /**
   * Metrics collection methods
   */
  private async getSystemMetrics() {
    const feedSources = await this.db.getFeedSources({ activeOnly: true });
    
    // Simplified metrics for local deployment
    return {
      active_feeds: feedSources.length,
      total_articles: 0, // Would need a count query
      pending_translations: 0, // Would need a count query
      system_uptime: this.getUptime()
    };
  }

  private async getFeedMetrics() {
    const feedSources = await this.db.getFeedSources();
    const activeSources = feedSources.filter(f => f.is_active);
    
    return {
      total_feeds: feedSources.length,
      active_feeds: activeSources.length,
      avg_fetch_time: 2000, // Mock value
      success_rate: 0.95, // Mock value
      articles_per_day: 150 // Mock value
    };
  }

  private async getTranslationMetrics() {
    const queueMetrics = await this.translationPipeline.getQueueMetrics();
    
    return {
      queue_size: queueMetrics.queued,
      completed_today: queueMetrics.completed_today,
      avg_quality_score: queueMetrics.avg_quality_score,
      avg_processing_time: queueMetrics.avg_processing_time,
      success_rate: 0.9 // Mock calculation
    };
  }

  /**
   * Alert management
   */
  private updateAlerts(components: Record<string, ComponentHealth>): void {
    Object.entries(components).forEach(([componentName, health]) => {
      if (health.status === 'unhealthy') {
        this.addAlert('high', componentName, health.message || 'Component unhealthy');
      } else if (health.status === 'degraded') {
        this.addAlert('medium', componentName, health.message || 'Component degraded');
      } else {
        // Resolve any existing alerts for healthy components
        this.resolveAlerts(componentName);
      }
    });
  }

  private addAlert(severity: Alert['severity'], component: string, message: string): void {
    const existingAlert = this.alerts.find(
      alert => alert.component === component && alert.message === message && !alert.resolved
    );

    if (!existingAlert) {
      this.alerts.push({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        severity,
        component,
        message,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
  }

  private resolveAlerts(component: string): void {
    this.alerts.forEach(alert => {
      if (alert.component === component && !alert.resolved) {
        alert.resolved = true;
      }
    });
  }

  /**
   * Helper methods
   */
  private calculateOverallStatus(components: Record<string, ComponentHealth>): 'healthy' | 'degraded' | 'unhealthy' {
    const statuses = Object.values(components).map(c => c.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  private getResultValue<T>(result: PromiseSettledResult<T>, defaultValue: T): T {
    return result.status === 'fulfilled' ? result.value : defaultValue;
  }

  private getUptime(): string {
    const uptimeMs = Date.now() - this.startTime.getTime();
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  private getUptimeHours(): number {
    return Math.floor((Date.now() - this.startTime.getTime()) / (1000 * 60 * 60));
  }

  private getMemoryUsage(): string {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return `${Math.round(usage.heapUsed / 1024 / 1024)}MB`;
    }
    return 'Unknown';
  }

  /**
   * Maintenance operations
   */
  async runMaintenance(): Promise<{
    database_cleanup: { removed_records: number; optimized_tables: string[] };
    alert_cleanup: { resolved_alerts: number };
  }> {
    try {
      // Clean up old resolved alerts
      const initialAlertCount = this.alerts.length;
      const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      this.alerts = this.alerts.filter(alert => 
        !alert.resolved || new Date(alert.timestamp) > cutoffDate
      );
      
      const resolvedAlerts = initialAlertCount - this.alerts.length;

      // Run database maintenance
      const dbMaintenance = await this.db.runMaintenance();

      return {
        database_cleanup: dbMaintenance,
        alert_cleanup: { resolved_alerts: resolvedAlerts }
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'runMaintenance' });
      throw error;
    }
  }
}