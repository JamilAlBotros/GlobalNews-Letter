import type { FastifyPluginAsync } from 'fastify';
import { SimpleEnhancedDatabaseService } from '../../services/simple-enhanced-database.js';
import { v4 as uuidv4 } from 'uuid';
import {
  // Feed Source Schemas
  FeedSourceSchema,
  CreateFeedSourceSchema,
  UpdateFeedSourceSchema,
  // Feed Instance Schemas  
  FeedInstanceSchema,
  FeedQuerySchema,
  // Response Schemas
  PaginatedResponseSchema
} from '../schemas/enhanced-schemas.js';

/**
 * Enhanced RSS Feed Routes (Simplified)
 * Basic feed source management without complex dependencies
 */

const enhancedFeedsRoutes: FastifyPluginAsync = async (fastify, opts) => {
  console.log('🚀 Loading simplified enhanced feeds routes...');
  
  // Initialize simplified database service
  console.log('📊 Initializing database service...');
  const dbPath = './data/enhanced-rss.db';
  const db = new SimpleEnhancedDatabaseService(dbPath);
  await db.initialize();
  console.log('✅ Database service initialized');
  
  // Test database connection
  try {
    console.log('🧪 Testing database connection...');
    const testSources = await db.getFeedSources();
    console.log(`🧪 Database test: found ${testSources.length} sources`);
    if (testSources.length > 0) {
      console.log('🧪 Sample source:', testSources[0].name);
    }
  } catch (testError) {
    console.error('❌ Database test failed:', testError);
  }

  // ============================================
  // FEED SOURCE MANAGEMENT
  // ============================================

  // GET /api/enhanced/feeds/sources - List feed sources with filters
  fastify.get('/feeds/sources', {
    schema: {
      querystring: FeedQuerySchema,
      response: {
        200: PaginatedResponseSchema(FeedSourceSchema)
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      console.log('🔍 Getting feed sources with query:', query);
      
      const sources = await db.getFeedSources({
        language: query.language,
        category: query.category,
        activeOnly: query.active
      });
      console.log(`📊 Found ${sources.length} total sources`);
      
      if (sources.length > 0) {
        console.log('📊 First source:', sources[0].name);
      }
      
      // Apply pagination
      const page = query.page;
      const limit = query.limit;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedSources = sources.slice(startIndex, endIndex);
      
      console.log(`📄 Paginated: ${paginatedSources.length} sources (page ${page}, limit ${limit})`);

      const result = {
        data: paginatedSources,
        pagination: {
          page: page,
          limit: limit,
          total: sources.length,
          totalPages: Math.ceil(sources.length / limit)
        }
      };
      
      return result;
    } catch (error) {
      console.error('💥 Error in /feeds/sources:', error);
      throw error;
    }
  });

  // POST /api/enhanced/feeds/sources - Create new feed source  
  fastify.post('/feeds/sources', {
    schema: {
      body: CreateFeedSourceSchema,
      response: {
        201: FeedSourceSchema,
        409: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    try {
      const body = request.body as any;
      console.log('➕ Creating new feed source:', body.name);
      
      const sourceId = uuidv4();
      const feedSource = {
        id: sourceId,
        ...body,
        is_active: true,
        quality_score: 0.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await db.saveFeedSource(feedSource);
      reply.code(201);
      console.log('✅ Feed source created:', feedSource.name);
      return feedSource;
    } catch (error) {
      console.error('❌ Error creating feed source:', error);
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        reply.code(409);
        return { error: 'Feed source URL already exists' };
      }
      throw error;
    }
  });

  // PUT /api/enhanced/feeds/sources/:id - Update feed source
  fastify.put('/feeds/sources/:id', {
    schema: {
      params: { type: 'object', properties: { id: { type: 'string', format: 'uuid' } } },
      body: UpdateFeedSourceSchema,
      response: {
        200: FeedSourceSchema,
        404: { type: 'object', properties: { error: { type: 'string' } } }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updates = request.body as any;
      console.log('📝 Updating feed source:', id);

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
      console.log('✅ Feed source updated:', updatedSource.name);
      return updatedSource;
    } catch (error) {
      console.error('❌ Error updating feed source:', error);
      throw error;
    }
  });

  // ============================================
  // FEED INSTANCE MANAGEMENT (Basic)
  // ============================================

  // GET /api/enhanced/instances - List feed instances
  fastify.get('/instances', {
    schema: {
      querystring: FeedQuerySchema,
      response: {
        200: PaginatedResponseSchema(FeedInstanceSchema)
      }
    }
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      console.log('🔍 Getting feed instances with query:', query);
      
      let instances: any[] = [];
      if (query.refresh_tier) {
        instances = await db.getFeedInstancesForRefresh(query.refresh_tier);
      } else {
        instances = await db.getFeedInstances();
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
    } catch (error) {
      console.error('💥 Error in /instances:', error);
      throw error;
    }
  });

  // ============================================
  // DEBUG ROUTES
  // ============================================

  // Debug route
  fastify.get('/debug', async (request, reply) => {
    console.log('🧪 Debug route hit!');
    try {
      const sources = await db.getFeedSources();
      return { 
        message: 'Simplified enhanced feeds working', 
        timestamp: new Date().toISOString(),
        sourceCount: sources.length,
        firstSource: sources[0] || null,
        dbPath: dbPath
      };
    } catch (error) {
      console.error('❌ Debug route error:', error);
      return {
        message: 'Debug route error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
    }
  });

  console.log('✅ Enhanced feeds routes (simplified) loaded successfully');
};

export default enhancedFeedsRoutes;