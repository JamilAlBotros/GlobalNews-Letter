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
  private rssPoller?: RSSPoller;
  private startTime: number;

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startTime = Date.now();
    this.database = new EnhancedDatabaseService();
    this.authService = new AuthService();
    
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

    // Structured logging
    this.fastify.addHook('onResponse', async (request, reply) => {
      const duration = performance.now() - (request as any).startTime;
      
      this.fastify.log.info({
        requestId: (request as any).requestId,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: Math.round(duration),
        userAgent: request.headers['user-agent'],
        ip: request.ip,
        userId: (request as any).user?.sub
      }, 'Request completed');
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
      // Initialize database
      await this.database.initialize();
      
      await this.fastify.listen({ 
        port: this.config.port, 
        host: this.config.host 
      });
      
      this.fastify.log.info({
        port: this.config.port,
        host: this.config.host,
        environment: this.config.environment,
        version: this.config.version
      }, 'Server started successfully');
      
    } catch (error) {
      this.fastify.log.error('Failed to start server:', error);
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
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ApiServer();
  await server.start();
}