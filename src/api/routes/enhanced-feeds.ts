import { FastifyPluginAsync } from 'fastify';
import { 
  FeedQuerySchema,
  CreateFeedSourceSchema,
  UpdateFeedSourceSchema,
  CreateFeedInstanceSchema,
  UpdateFeedInstanceSchema,
  CreateTranslationRequestSchema,
  ArticleQuerySchema,
  TranslationQuerySchema,
  PaginatedResponseSchema,
  FeedSourceSchema,
  FeedInstanceSchema,
  ArticleOriginalSchema,
  ArticleTranslationSchema,
  HealthCheckResponseSchema
} from '../schemas/enhanced-schemas.js';
import { EnhancedDatabaseService } from '../../services/enhanced-database.js';
import { FeedManager } from '../../services/feed-manager.js';
import { TranslationPipeline } from '../../services/translation-pipeline.js';
import { HealthAnalyticsService } from '../../services/health-analytics.js';
import { LanguageDetectionService } from '../../services/language-detection.js';
import { LLMService } from '../../services/llm.js';
import { RSSService } from '../../services/rss.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Enhanced RSS Feed and Translation API Routes
 * Contract-first API implementation following CLAUDE.md guidelines
 */

const enhancedFeedsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  // Initialize services
  const db = new EnhancedDatabaseService();
  const languageDetection = new LanguageDetectionService();
  const rssService = new RSSService();
  const llmService = new LLMService();
  const feedManager = new FeedManager(db, languageDetection, rssService);
  const translationPipeline = new TranslationPipeline(db, llmService);
  const healthAnalytics = new HealthAnalyticsService(db);

  await db.initialize();

  // ============================================
  // FEED SOURCE MANAGEMENT
  // ============================================

  // GET /api/v2/feeds/sources - List feed sources with filters
  fastify.get('/sources', {
    schema: {
      querystring: FeedQuerySchema,
      response: {
        200: PaginatedResponseSchema(FeedSourceSchema)
      }
    }
  }, async (request, reply) => {
    const query = request.query as any;
    
    const sources = await db.getFeedSources({
      language: query.language,
      category: query.category,
      activeOnly: query.active
    });

    const startIndex = (query.page - 1) * query.limit;
    const endIndex = startIndex + query.limit;
    const paginatedSources = sources.slice(startIndex, endIndex);

    return {
      data: paginatedSources,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: sources.length,
        totalPages: Math.ceil(sources.length / query.limit)
      }
    };
  });

  // POST /api/v2/feeds/sources - Create new feed source
  fastify.post('/sources', {
    schema: {
      body: CreateFeedSourceSchema,
      response: {
        201: FeedSourceSchema,
        409: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    const body = request.body as any;
    
    const sourceId = uuidv4();
    const feedSource = {
      id: sourceId,
      ...body,
      is_active: true,
      quality_score: 0.5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      await db.saveFeedSource(feedSource);
      reply.code(201);
      return feedSource;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        reply.code(409);
        return { error: 'Feed source URL already exists' };
      }
      throw error;
    }
  });

  // PUT /api/v2/feeds/sources/:id - Update feed source
  fastify.put('/sources/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: UpdateFeedSourceSchema,
      response: {
        200: FeedSourceSchema,
        404: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updates = request.body as any;

    const existingSource = await db.getFeedSource(id);
    if (!existingSource) {
      reply.code(404);
      return { error: 'Feed source not found' };
    }

    const updatedSource = {
      ...existingSource,
      ...updates,
      updated_at: new Date().toISOString()
    };

    await db.saveFeedSource(updatedSource);
    return updatedSource;
  });

  // ============================================
  // FEED INSTANCE MANAGEMENT
  // ============================================

  // GET /api/v2/feeds/instances - List feed instances
  fastify.get('/instances', {
    schema: {
      querystring: FeedQuerySchema,
      response: {
        200: PaginatedResponseSchema(FeedInstanceSchema)
      }
    }
  }, async (request, reply) => {
    const query = request.query as any;
    
    // Get instances by refresh tier if specified
    let instances: any[] = [];
    if (query.refresh_tier) {
      instances = await db.getFeedInstancesForRefresh(query.refresh_tier);
    } else {
      // Would need additional query method for general instance listing
      instances = [];
    }

    const startIndex = (query.page - 1) * query.limit;
    const endIndex = startIndex + query.limit;
    const paginatedInstances = instances.slice(startIndex, endIndex);

    return {
      data: paginatedInstances,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: instances.length,
        totalPages: Math.ceil(instances.length / query.limit)
      }
    };
  });

  // POST /api/v2/feeds/instances - Create feed instance
  fastify.post('/instances', {
    schema: {
      body: CreateFeedInstanceSchema,
      response: {
        201: FeedInstanceSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    const body = request.body as any;
    
    // Verify source exists
    const source = await db.getFeedSource(body.source_id);
    if (!source) {
      reply.code(400);
      return { error: 'Feed source not found' };
    }

    const instanceId = uuidv4();
    const feedInstance = {
      id: instanceId,
      ...body,
      consecutive_failures: 0,
      avg_articles_per_fetch: 0,
      reliability_score: 1.0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    await db.saveFeedInstance(feedInstance);
    reply.code(201);
    return feedInstance;
  });

  // ============================================
  // ARTICLE MANAGEMENT
  // ============================================

  // GET /api/v2/articles - List articles with filters
  fastify.get('/articles', {
    schema: {
      querystring: ArticleQuerySchema,
      response: {
        200: PaginatedResponseSchema(ArticleOriginalSchema)
      }
    }
  }, async (request, reply) => {
    const query = request.query as any;
    
    const articles = await db.getArticlesForTranslation(
      query.limit * query.page, // Simplified pagination
      query.urgency,
      query.language
    );

    const startIndex = (query.page - 1) * query.limit;
    const paginatedArticles = articles.slice(startIndex, startIndex + query.limit);

    return {
      data: paginatedArticles,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: articles.length,
        totalPages: Math.ceil(articles.length / query.limit)
      }
    };
  });

  // POST /api/v2/articles/:id/select - Mark article as selected for newsletter
  fastify.post('/articles/:id/select', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string' } } },
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        404: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    
    try {
      await db.updateArticleProcessingStage(id, 'published');
      return { success: true };
    } catch (error) {
      reply.code(404);
      return { error: 'Article not found' };
    }
  });

  // ============================================
  // TRANSLATION MANAGEMENT
  // ============================================

  // POST /api/v2/translations - Create translation jobs
  fastify.post('/translations', {
    schema: {
      body: CreateTranslationRequestSchema,
      response: {
        201: { 
          type: 'object', 
          properties: { 
            job_ids: { type: 'array', items: { type: 'string', format: 'uuid' } },
            estimated_completion: { type: 'string', format: 'date-time' }
          } 
        },
        400: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    const body = request.body as any;
    
    try {
      const jobIds = await translationPipeline.createTranslationJobs(
        body.original_article_id,
        body.target_languages,
        body.priority
      );

      // Calculate estimated completion
      const estimatedCompletion = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      reply.code(201);
      return {
        job_ids: jobIds,
        estimated_completion: estimatedCompletion.toISOString()
      };
    } catch (error) {
      reply.code(400);
      return { error: error instanceof Error ? error.message : 'Translation job creation failed' };
    }
  });

  // GET /api/v2/translations - List translations with filters
  fastify.get('/translations', {
    schema: {
      querystring: TranslationQuerySchema,
      response: {
        200: PaginatedResponseSchema(ArticleTranslationSchema)
      }
    }
  }, async (request, reply) => {
    const query = request.query as any;
    
    // Get translated articles for publishing (simplified)
    const articles = await db.getTranslatedArticlesForPublishing(
      query.target_language || 'es',
      query.limit
    );

    // Transform to translation format
    const translations = articles.map(article => ({
      id: article.translation_id,
      original_article_id: article.id,
      target_language: query.target_language,
      title_translated: article.title_translated,
      description_translated: article.description_translated,
      content_translated: article.content_translated,
      summary_translated: article.summary_translated,
      translation_method: 'ai' as const,
      human_reviewed: false,
      translation_status: 'completed' as const,
      translation_quality_score: article.translation_quality_score,
      translation_completed_at: article.translation_completed_at,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    return {
      data: translations,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: translations.length,
        totalPages: Math.ceil(translations.length / query.limit)
      }
    };
  });

  // ============================================
  // FEED PROCESSING
  // ============================================

  // POST /api/v2/feeds/process - Manually trigger feed processing
  fastify.post('/process', {
    schema: {
      body: {
        type: 'object',
        properties: {
          tier: { type: 'string', enum: ['realtime', 'frequent', 'standard', 'slow'] },
          concurrency: { type: 'number', minimum: 1, maximum: 10 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            processed: { type: 'number' },
            successful: { type: 'number' },
            totalArticles: { type: 'number' },
            totalNewArticles: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { tier = 'standard', concurrency = 3 } = request.body as any;
    
    const result = await feedManager.processFeedsByTier(tier, concurrency);
    return result;
  });

  // GET /api/v2/feeds/queue/metrics - Get translation queue metrics
  fastify.get('/queue/metrics', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            queued: { type: 'number' },
            processing: { type: 'number' },
            completed_today: { type: 'number' },
            failed_today: { type: 'number' },
            avg_processing_time: { type: 'number' },
            avg_quality_score: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const metrics = await translationPipeline.getQueueMetrics();
    return metrics;
  });

  // ============================================
  // HEALTH AND ANALYTICS
  // ============================================

  // GET /api/v2/health - System health check
  fastify.get('/health', {
    schema: {
      response: {
        200: HealthCheckResponseSchema
      }
    }
  }, async (request, reply) => {
    const healthCheck = await healthAnalytics.performHealthCheck();
    return healthCheck;
  });

  // GET /api/v2/analytics/performance - Performance metrics
  fastify.get('/analytics/performance', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          days: { type: 'string', pattern: '^\\d+$', default: '7' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            feed_performance: { type: 'object' },
            translation_performance: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { days = '7' } = request.query as any;
    const metrics = await healthAnalytics.getPerformanceMetrics(parseInt(days));
    return metrics;
  });

  // GET /api/v2/analytics/feeds - Feed performance summary
  fastify.get('/analytics/feeds', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              source_name: { type: 'string' },
              instance_name: { type: 'string' },
              source_language: { type: 'string' },
              content_category: { type: 'string' },
              refresh_tier: { type: 'string' },
              reliability_score: { type: 'number' },
              total_articles_24h: { type: 'number' },
              high_quality_articles: { type: 'number' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const summary = await db.getFeedPerformanceSummary();
    return summary;
  });

  // POST /api/v2/maintenance - Run system maintenance
  fastify.post('/maintenance', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            database_cleanup: { type: 'object' },
            health_cleanup: { type: 'object' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const [dbCleanup, healthCleanup] = await Promise.all([
      db.runMaintenance(),
      healthAnalytics.runMaintenance()
    ]);

    return {
      database_cleanup: dbCleanup,
      health_cleanup: healthCleanup
    };
  });
};

export default enhancedFeedsRoutes;