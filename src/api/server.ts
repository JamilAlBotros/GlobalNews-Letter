#!/usr/bin/env node

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

import { createProblemDetails, HealthCheckResponseSchema, ReadinessCheckResponseSchema } from './schemas/common-schemas.js';
import { env, securityConfig, isDevelopment } from '../config/environment.js';
import { AuthService } from '../services/auth-service.js';
import { EnhancedDatabaseService } from '../services/enhanced-database.js';
import { LLMService } from '../services/llm-service.js';
import { RSSProcessor } from '../services/rss-processor.js';
import { TranslationPipeline } from '../services/translation-pipeline.js';
import { HealthMonitor } from '../services/health-monitor.js';
import { RSSPoller } from '../services/rss-poller.js';
import enhancedFeedsRoutes from './routes/enhanced-feeds.js';

/**
 * GlobalNews Letter API Server
 * Following CLAUDE.md MVP guidelines with Fastify
 */

export interface ServerConfig {
  port: number;
  host: string;
  corsOrigins: string[];
  rateLimitRps: number;
  environment: 'development' | 'staging' | 'production';
  version: string;
}

// Default configuration from environment
const DEFAULT_CONFIG: ServerConfig = {
  port: env.API_PORT,
  host: env.API_HOST,
  corsOrigins: securityConfig.cors.origins,
  rateLimitRps: securityConfig.rateLimit.rps,
  environment: env.NODE_ENV,
  version: '1.0.0'
};

export class ApiServer {
  private fastify: FastifyInstance;
  private config: ServerConfig;
  private database: EnhancedDatabaseService;
  private authService: AuthService;
  private llmService: LLMService;
  private rssProcessor: RSSProcessor;
  private translationPipeline: TranslationPipeline;
  private healthMonitor: HealthMonitor;
  private rssPoller?: RSSPoller;
  private startTime: number;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
    this.database = new EnhancedDatabaseService();
    this.authService = new AuthService();
    this.llmService = new LLMService();
    this.rssProcessor = new RSSProcessor(this.database, this.llmService);
    this.translationPipeline = new TranslationPipeline(this.database, this.llmService);
    this.healthMonitor = new HealthMonitor(
      this.database,
      this.llmService,
      this.rssProcessor,
      this.translationPipeline,
      this.authService
    );
    
    // Initialize Fastify with logging
    this.fastify = Fastify({
      logger: {
        level: this.config.environment === 'production' ? 'warn' : 'info',
        serializers: {
          req: (request) => ({
            method: request.method,
            url: request.url,
            hostname: request.hostname,
            remoteAddress: request.ip,
            remotePort: request.socket?.remotePort
          }),
          res: (response) => ({
            statusCode: response.statusCode
          })
        }
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupGracefulShutdown();
  }

  /**
   * Setup middleware following CLAUDE.md guidelines
   */
  private setupMiddleware(): void {
    // Request ID and timing
    this.fastify.addHook('onRequest', async (request, reply) => {
      const requestId = randomUUID();
      (request as any).requestId = requestId;
      (request as any).startTime = performance.now();
      
      // Add request ID to response headers for debugging
      reply.header('x-request-id', requestId);
    });

    // CORS allowlist (no wildcard in production)
    this.fastify.register(cors, {
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g., mobile apps, curl)
        if (!origin) return callback(null, true);
        
        const isAllowed = this.config.corsOrigins.some(allowedOrigin => {
          if (isDevelopment) {
            return origin.startsWith('http://localhost') || origin === allowedOrigin;
          }
          return origin === allowedOrigin;
        });
        
        callback(isAllowed ? null : new Error('CORS not allowed'), isAllowed);
      },
      credentials: true
    });

    // Rate limiting (per-IP token bucket)
    this.fastify.register(rateLimit, {
      max: this.config.rateLimitRps * 60, // requests per minute
      timeWindow: '1 minute',
      errorResponseBuilder: () => ({
        type: 'about:blank',
        title: 'Too Many Requests',
        status: 429,
        detail: `Rate limit exceeded. Maximum ${this.config.rateLimitRps} requests per minute.`,
        timestamp: new Date().toISOString()
      })
    });

    // Authentication hook (skip for public routes)
    this.fastify.addHook('preHandler', async (request, reply) => {
      // Skip auth for health checks and public routes
      const publicRoutes = ['/healthz', '/readyz', '/api/v1'];
      const isPublicRoute = publicRoutes.some(route => request.url.startsWith(route));
      
      if (isPublicRoute || env.DEV_SKIP_AUTH) {
        return;
      }

      try {
        const authHeader = request.headers.authorization;
        const user = await this.authService.authenticateRequest(authHeader);
        
        // Attach user to request for use in handlers
        (request as any).user = user;
      } catch (error) {
        const statusCode = error instanceof Error && 'statusCode' in error ? 
          (error as any).statusCode : 401;
        
        reply.code(statusCode).type('application/problem+json').send({
          type: 'about:blank',
          title: 'Authentication Failed',
          status: statusCode,
          detail: error instanceof Error ? error.message : 'Authentication required',
          instance: request.url,
          requestId: (request as any).requestId
        });
      }
    });

    // Structured logging with verbose health monitoring
    this.fastify.addHook('onResponse', async (request, reply) => {
      const duration = performance.now() - (request as any).startTime;
      
      // Enhanced logging with health monitoring context
      const logData = {
        requestId: (request as any).requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: Math.round(duration),
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: (request as any).user?.sub,
        timestamp: new Date().toISOString(),
        // Add health context for monitoring
        isHealthEndpoint: request.url.includes('/health'),
        isSlowRequest: duration > 1000,
        isErrorStatus: reply.statusCode >= 400
      };

      // Log performance warnings
      if (duration > 2000) {
        this.fastify.log.warn(logData, `Slow request detected: ${Math.round(duration)}ms`);
      } else if (duration > 1000) {
        this.fastify.log.info(logData, `Request completed (slow): ${Math.round(duration)}ms`);
      } else {
        this.fastify.log.info(logData, 'Request completed');
      }

      // Log health monitoring metrics periodically
      if (request.url.includes('/health') || request.url.includes('/readyz')) {
        this.fastify.log.info({
          ...logData,
          healthCheck: true,
          uptime: Date.now() - this.startTime,
          memoryUsage: process.memoryUsage()
        }, 'Health check performed');
      }
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health endpoints (required by CLAUDE.md)
    this.fastify.get('/healthz', async () => {
      return HealthCheckResponseSchema.parse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: Date.now() - this.startTime,
        version: this.config.version
      });
    });

    this.fastify.get('/readyz', async () => {
      let databaseStatus: 'ok' | 'error' = 'ok';
      let databaseResponseTime = 0;
      let databaseError: string | undefined;
      
      try {
        const start = performance.now();
        // Simple health check query
        await this.database.initialize();
        databaseResponseTime = performance.now() - start;
      } catch (error) {
        databaseStatus = 'error';
        databaseError = error instanceof Error ? error.message : 'Unknown error';
      }

      const pollingStatus = this.rssPoller ? 'running' : 'stopped';
      const ready = databaseStatus === 'ok' && pollingStatus !== 'error';

      return ReadinessCheckResponseSchema.parse({
        ready,
        timestamp: new Date().toISOString(),
        checks: {
          database: {
            status: databaseStatus,
            responseTime: databaseResponseTime,
            error: databaseError
          },
          polling: {
            status: pollingStatus as any,
            lastPoll: undefined, // Would need to get from poller
            error: undefined
          }
        }
      });
    });

    // API root
    this.fastify.get('/api/v1', async () => ({
      service: 'GlobalNews Letter API',
      version: this.config.version,
      environment: this.config.environment,
      timestamp: new Date().toISOString(),
      documentation: '/api/v1/docs'
    }));

    // Authentication endpoints
    this.fastify.post('/api/v1/auth/login', {
      schema: {
        body: {
          type: 'object',
          properties: {
            username: { type: 'string' },
            password: { type: 'string' },
            apiKey: { type: 'string' }
          },
          anyOf: [
            { required: ['username', 'password'] },
            { required: ['apiKey'] }
          ]
        },
        response: {
          200: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              tokenType: { type: 'string' },
              expiresAt: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { username, password, apiKey } = request.body as any;
      
      try {
        const authToken = await this.authService.authenticate(username, password, apiKey);
        return authToken;
      } catch (error) {
        const statusCode = error instanceof Error && 'statusCode' in error ? 
          (error as any).statusCode : 401;
        
        reply.code(statusCode).type('application/problem+json').send({
          type: 'about:blank',
          title: 'Authentication Failed',
          status: statusCode,
          detail: error instanceof Error ? error.message : 'Authentication failed',
          instance: request.url,
          requestId: (request as any).requestId
        });
      }
    });

    // Register route plugins
    this.registerFeedRoutes();
    this.registerPollingRoutes();
    this.registerArticleRoutes();
    this.registerHealthRoutes();
    
    // Register enhanced routes
    this.fastify.register(enhancedFeedsRoutes, { prefix: '/api/enhanced' });
  }

  /**
   * Setup error handling with RFC 7807 Problem Details
   */
  private setupErrorHandling(): void {
    this.fastify.setErrorHandler(async (error, request, reply) => {
      const requestId = (request as any).requestId;
      
      // Log error
      this.fastify.log.error({
        requestId,
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method
      }, 'Request error');

      // Determine status code
      let status = 500;
      if ('statusCode' in error && typeof error.statusCode === 'number') {
        status = error.statusCode;
      } else if (error.name === 'ValidationError') {
        status = 400;
      }

      // Create Problem Details response
      const problem = createProblemDetails(
        status >= 500 ? 'Internal Server Error' : error.message,
        status,
        status >= 500 ? 'An unexpected error occurred' : error.message,
        request.url,
        requestId
      );

      reply
        .code(status)
        .type('application/problem+json')
        .send(problem);
    });

    // 404 handler
    this.fastify.setNotFoundHandler(async (request, reply) => {
      const problem = createProblemDetails(
        'Not Found',
        404,
        `Route ${request.method} ${request.url} not found`,
        request.url,
        (request as any).requestId
      );

      reply
        .code(404)
        .type('application/problem+json')
        .send(problem);
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = async (signal: string) => {
      this.fastify.log.info(`Received ${signal}, shutting down gracefully`);
      
      try {
        // Stop RSS poller if running
        if (this.rssPoller) {
          this.rssPoller.stop();
        }

        // Close database connections
        this.database.close();

        // Close Fastify server
        await this.fastify.close();
        
        this.fastify.log.info('Server shut down successfully');
        process.exit(0);
      } catch (error) {
        this.fastify.log.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  /**
   * Placeholder route registration methods
   */
  private registerFeedRoutes(): void {
    // Will implement in next step
    this.fastify.register(async (fastify) => {
      fastify.get('/api/v1/feeds', async () => ({ message: 'Feed routes coming soon' }));
    });
  }

  private registerPollingRoutes(): void {
    // Will implement in next step  
    this.fastify.register(async (fastify) => {
      fastify.get('/api/v1/polling/status', async () => ({ message: 'Polling routes coming soon' }));
    });
  }

  private registerArticleRoutes(): void {
    // Will implement in next step
    this.fastify.register(async (fastify) => {
      fastify.get('/api/v1/articles', async () => ({ message: 'Article routes coming soon' }));
    });
  }

  private registerHealthRoutes(): void {
    // Will implement in next step
    this.fastify.register(async (fastify) => {
      fastify.get('/api/v1/health', async () => ({ message: 'Health routes coming soon' }));
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      this.fastify.log.info('Starting GlobalNews Letter API server...');
      
      // Initialize database with verbose logging
      this.fastify.log.info('Initializing database connection...');
      await this.database.initialize();
      this.fastify.log.info('Database initialized successfully');
      
      // Start health monitoring
      this.fastify.log.info('Starting health monitoring system...');
      const healthStatus = await this.healthMonitor.getSystemHealth();
      this.fastify.log.info({
        overallStatus: healthStatus.overall_status,
        activeComponents: Object.keys(healthStatus.components),
        uptime: healthStatus.metrics.system_uptime
      }, 'Health monitoring initialized');
      
      // Start server
      this.fastify.log.info(`Starting server on ${this.config.host}:${this.config.port}...`);
      await this.fastify.listen({ 
        port: this.config.port, 
        host: this.config.host 
      });
      
      this.fastify.log.info({
        port: this.config.port,
        host: this.config.host,
        environment: this.config.environment,
        version: this.config.version,
        pid: process.pid,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        startTime: new Date().toISOString()
      }, 'Server started successfully');
      
      // Log periodic health updates
      this.scheduleHealthLogging();
      
    } catch (error) {
      this.fastify.log.error({
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      }, 'Failed to start server');
      process.exit(1);
    }
  }

  /**
   * Get Fastify instance for testing
   */
  getServer(): FastifyInstance {
    return this.fastify;
  }

  /**
   * Set RSS poller instance
   */
  setRSSPoller(poller: RSSPoller): void {
    this.rssPoller = poller;
    this.fastify.log.info('RSS poller attached to server');
  }

  /**
   * Schedule periodic health logging
   */
  private scheduleHealthLogging(): void {
    // Log health status every 5 minutes
    setInterval(async () => {
      try {
        const healthStatus = await this.healthMonitor.getSystemHealth();
        this.fastify.log.info({
          overallStatus: healthStatus.overall_status,
          components: Object.fromEntries(
            Object.entries(healthStatus.components).map(([key, comp]) => [
              key, 
              { status: comp.status, responseTime: comp.response_time }
            ])
          ),
          metrics: {
            uptime: healthStatus.metrics.system_uptime,
            memoryUsage: healthStatus.metrics.memory_usage,
            activeFeeds: healthStatus.metrics.active_feeds,
            totalArticles: healthStatus.metrics.total_articles
          },
          alertCount: healthStatus.alerts.length
        }, 'Periodic health check');
      } catch (error) {
        this.fastify.log.error({
          error: error instanceof Error ? error.message : 'Unknown error',
          operation: 'periodicHealthCheck'
        }, 'Failed to perform periodic health check');
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.fastify.log.info('Scheduled periodic health logging every 5 minutes');
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ApiServer();
  await server.start();
}