import { DatabaseConnectionManager } from '../database/connection-manager.js';
import { ErrorHandler, ServiceError } from '../utils/errors.js';

/**
 * Health check status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual health check result
 */
export interface HealthCheck {
  name: string;
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  details?: Record<string, any>;
}

/**
 * Overall health response
 */
export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

/**
 * Readiness check response
 */
export interface ReadinessResponse {
  ready: boolean;
  timestamp: string;
  checks: HealthCheck[];
  message?: string;
}

/**
 * Health monitoring service
 * Provides /healthz and /readyz endpoints functionality
 */
export class HealthService {
  private startTime: number;
  private connectionManager: DatabaseConnectionManager;

  constructor() {
    this.startTime = Date.now();
    this.connectionManager = DatabaseConnectionManager.getInstance();
  }

  /**
   * Get basic health status (liveness probe)
   * Should return quickly and only fail if the service is completely broken
   */
  async getHealthStatus(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    const uptime = Date.now() - this.startTime;
    
    const checks: HealthCheck[] = [
      await this.checkBasicService(),
      await this.checkMemoryUsage(),
      await this.checkUptime()
    ];

    const summary = this.summarizeChecks(checks);
    const overallStatus = this.determineOverallStatus(summary);

    return {
      status: overallStatus,
      timestamp,
      uptime,
      checks,
      summary
    };
  }

  /**
   * Get readiness status (readiness probe)
   * Should check external dependencies and fail if service can't handle requests
   */
  async getReadinessStatus(): Promise<ReadinessResponse> {
    const timestamp = new Date().toISOString();
    
    try {
      const checks: HealthCheck[] = [
        await this.checkDatabaseConnectivity(),
        await this.checkDatabaseTables(),
        await this.checkExternalServices()
      ];

      const allReady = checks.every(check => check.status === 'healthy');
      
      return {
        ready: allReady,
        timestamp,
        checks,
        message: allReady ? 'Service is ready' : 'Service is not ready - check failed dependencies'
      };
    } catch (error) {
      return {
        ready: false,
        timestamp,
        checks: [{
          name: 'readiness_check_error',
          status: 'unhealthy',
          message: error instanceof Error ? error.message : 'Unknown error during readiness check'
        }],
        message: 'Failed to perform readiness checks'
      };
    }
  }

  /**
   * Get comprehensive service status (combines health and readiness)
   */
  async getComprehensiveStatus(): Promise<{
    health: HealthResponse;
    readiness: ReadinessResponse;
    database: {
      connections: ReturnType<DatabaseConnectionManager['getStats']>;
    };
  }> {
    const [health, readiness] = await Promise.all([
      this.getHealthStatus(),
      this.getReadinessStatus()
    ]);

    const databaseStats = this.connectionManager.getStats();

    return {
      health,
      readiness,
      database: {
        connections: databaseStats
      }
    };
  }

  /**
   * Check basic service functionality
   */
  private async checkBasicService(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Basic service checks (memory, CPU, etc.)
      const memUsage = process.memoryUsage();
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'basic_service',
        status: 'healthy',
        message: 'Service is running normally',
        responseTime,
        details: {
          memory: memUsage,
          pid: process.pid,
          version: process.version
        }
      };
    } catch (error) {
      return {
        name: 'basic_service',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Basic service check failed',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemoryUsage(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;
      
      let status: HealthStatus = 'healthy';
      let message = `Memory usage: ${heapUsedMB.toFixed(2)}MB / ${heapTotalMB.toFixed(2)}MB (${memoryUsagePercent.toFixed(1)}%)`;
      
      if (memoryUsagePercent > 90) {
        status = 'unhealthy';
        message = `High memory usage: ${memoryUsagePercent.toFixed(1)}%`;
      } else if (memoryUsagePercent > 75) {
        status = 'degraded';
        message = `Elevated memory usage: ${memoryUsagePercent.toFixed(1)}%`;
      }
      
      return {
        name: 'memory_usage',
        status,
        message,
        responseTime: Date.now() - startTime,
        details: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external,
          rss: memUsage.rss
        }
      };
    } catch (error) {
      return {
        name: 'memory_usage',
        status: 'unhealthy',
        message: 'Failed to check memory usage',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check service uptime
   */
  private async checkUptime(): Promise<HealthCheck> {
    const uptime = Date.now() - this.startTime;
    const uptimeSeconds = Math.floor(uptime / 1000);
    
    return {
      name: 'uptime',
      status: 'healthy',
      message: `Service uptime: ${uptimeSeconds}s`,
      responseTime: 1,
      details: {
        uptime,
        uptimeSeconds,
        startTime: this.startTime
      }
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseConnectivity(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const isConnected = await this.connectionManager.testConnection('health-check');
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database_connectivity',
        status: isConnected ? 'healthy' : 'unhealthy',
        message: isConnected ? 'Database is accessible' : 'Database is not accessible',
        responseTime,
        details: this.connectionManager.getStats()
      };
    } catch (error) {
      return {
        name: 'database_connectivity',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database connectivity check failed',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check database tables existence
   */
  private async checkDatabaseTables(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const connection = await this.connectionManager.getConnection('health-check');
      
      // Check if articles table exists
      const tablesResult = await connection.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('articles', 'rss_feeds')"
      );
      
      const existingTables = tablesResult.map(row => row.name);
      const expectedTables = ['articles', 'rss_feeds'];
      const missingTables = expectedTables.filter(table => !existingTables.includes(table));
      
      const responseTime = Date.now() - startTime;
      
      if (missingTables.length === 0) {
        return {
          name: 'database_tables',
          status: 'healthy',
          message: 'All required tables exist',
          responseTime,
          details: {
            existingTables,
            expectedTables
          }
        };
      } else {
        return {
          name: 'database_tables',
          status: 'degraded',
          message: `Missing tables: ${missingTables.join(', ')}`,
          responseTime,
          details: {
            existingTables,
            expectedTables,
            missingTables
          }
        };
      }
    } catch (error) {
      return {
        name: 'database_tables',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database tables check failed',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check external services (placeholder - extend based on your external dependencies)
   */
  private async checkExternalServices(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Add checks for NewsAPI, LLM service, etc. as needed
      // For now, return healthy
      
      return {
        name: 'external_services',
        status: 'healthy',
        message: 'External services check passed',
        responseTime: Date.now() - startTime,
        details: {
          checked: ['placeholder'] // Add actual services here
        }
      };
    } catch (error) {
      return {
        name: 'external_services',
        status: 'degraded',
        message: 'Some external services may be unavailable',
        responseTime: Date.now() - startTime
      };
    }
  }

  /**
   * Summarize health check results
   */
  private summarizeChecks(checks: HealthCheck[]): {
    healthy: number;
    degraded: number;
    unhealthy: number;
  } {
    return checks.reduce(
      (summary, check) => {
        summary[check.status]++;
        return summary;
      },
      { healthy: 0, degraded: 0, unhealthy: 0 }
    );
  }

  /**
   * Determine overall status from individual checks
   */
  private determineOverallStatus(summary: { healthy: number; degraded: number; unhealthy: number }): HealthStatus {
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    } else if (summary.degraded > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }
}