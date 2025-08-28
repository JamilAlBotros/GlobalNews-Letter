import { z } from 'zod';

/**
 * Common API Schemas
 * Following RFC 7807 Problem Details and CLAUDE.md guidelines
 */

// RFC 7807 Problem Details for HTTP APIs
export const ProblemDetailsSchema = z.object({
  type: z.string().url().default('about:blank'),
  title: z.string(),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  // Extension members for debugging
  requestId: z.string().optional(),
  timestamp: z.string().datetime().optional()
});

// Health check schemas
export const HealthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  uptime: z.number().min(0),
  version: z.string().optional()
});

export const ReadinessCheckResponseSchema = z.object({
  ready: z.boolean(),
  timestamp: z.string().datetime(),
  checks: z.object({
    database: z.object({
      status: z.enum(['ok', 'error']),
      responseTime: z.number().min(0),
      error: z.string().optional()
    }),
    polling: z.object({
      status: z.enum(['running', 'stopped', 'error']),
      lastPoll: z.string().datetime().optional(),
      error: z.string().optional()
    })
  })
});

// Detailed health information
export const DetailedHealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string().datetime(),
  uptime: z.number().min(0),
  version: z.string(),
  environment: z.string(),
  services: z.object({
    database: z.object({
      status: z.enum(['connected', 'disconnected', 'error']),
      connectionCount: z.number().int().min(0),
      responseTime: z.number().min(0),
      lastQuery: z.string().datetime().optional()
    }),
    rssPoller: z.object({
      status: z.enum(['running', 'stopped', 'error']),
      isRunning: z.boolean(),
      activeFeeds: z.number().int().min(0),
      lastPoll: z.string().datetime().optional(),
      nextPoll: z.string().datetime().optional(),
      totalArticles: z.number().int().min(0)
    }),
    languageDetection: z.object({
      status: z.enum(['enabled', 'disabled']),
      supportedLanguages: z.array(z.string()),
      detectionMethods: z.array(z.string())
    })
  }),
  metrics: z.object({
    requestsPerMinute: z.number().min(0).optional(),
    averageResponseTime: z.number().min(0).optional(),
    errorRate: z.number().min(0).max(1).optional()
  })
});

// Generic success response
export const SuccessResponseSchema = z.object({
  success: z.boolean().default(true),
  message: z.string().optional(),
  timestamp: z.string().datetime()
});

// Idempotency response wrapper
export const IdempotentResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    requestId: z.string(),
    timestamp: z.string().datetime(),
    idempotent: z.boolean().default(false)
  });

// Pagination metadata
export const PaginationMetaSchema = z.object({
  page: z.number().int().min(1),
  limit: z.number().int().min(1).max(100),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
  hasNext: z.boolean(),
  hasPrev: z.boolean()
});

// Common query parameters
export const PaginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20')
});

// API metadata
export const ApiMetadataSchema = z.object({
  version: z.string(),
  environment: z.string(),
  timestamp: z.string().datetime(),
  requestId: z.string(),
  processingTime: z.number().min(0)
});

// Export types
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type ReadinessCheckResponse = z.infer<typeof ReadinessCheckResponseSchema>;
export type DetailedHealthResponse = z.infer<typeof DetailedHealthResponseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type PaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type ApiMetadata = z.infer<typeof ApiMetadataSchema>;

// Utility functions
export const createProblemDetails = (
  title: string,
  status: number,
  detail?: string,
  instance?: string,
  requestId?: string
): ProblemDetails => ({
  type: 'about:blank',
  title,
  status,
  detail,
  instance,
  requestId,
  timestamp: new Date().toISOString()
});

export const createSuccessResponse = (message?: string): SuccessResponse => ({
  success: true,
  message,
  timestamp: new Date().toISOString()
});