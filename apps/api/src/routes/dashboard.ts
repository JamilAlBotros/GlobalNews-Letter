import { FastifyInstance } from 'fastify';
import { getDatabase } from '../database/connection.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  // Get dashboard statistics
  app.get('/dashboard/stats', async (request, reply) => {
    try {
      const db = getDatabase();
      
      // Get article counts by category
      const categoryStats = await db.all(`
        SELECT 
          f.category,
          COUNT(DISTINCT f.id) as active_feeds,
          COUNT(a.id) as total_articles,
          COUNT(CASE WHEN a.created_at::timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) as articles_last_24h,
          COUNT(CASE WHEN a.created_at::timestamp >= NOW() - INTERVAL '7 days' THEN 1 END) as articles_last_7d
        FROM feeds f
        LEFT JOIN articles a ON f.id = a.feed_id
        WHERE f.is_active = true
        GROUP BY f.category
        ORDER BY total_articles DESC
      `);

      // Get article counts by language
      const languageStats = await db.all(`
        SELECT 
          f.language,
          COUNT(DISTINCT f.id) as active_feeds,
          COUNT(a.id) as total_articles,
          COUNT(CASE WHEN a.created_at::timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) as articles_last_24h,
          COUNT(CASE WHEN a.created_at::timestamp >= NOW() - INTERVAL '7 days' THEN 1 END) as articles_last_7d
        FROM feeds f
        LEFT JOIN articles a ON f.id = a.feed_id
        WHERE f.is_active = true
        GROUP BY f.language
        ORDER BY total_articles DESC
      `);

      // Get overall statistics
      const overallStats = await db.get(`
        SELECT 
          COUNT(DISTINCT f.id) as total_active_feeds,
          COUNT(a.id) as total_articles,
          COUNT(CASE WHEN a.created_at::timestamp >= NOW() - INTERVAL '24 hours' THEN 1 END) as articles_last_24h,
          COUNT(CASE WHEN a.created_at::timestamp >= NOW() - INTERVAL '7 days' THEN 1 END) as articles_last_7d,
          MAX(a.created_at::timestamp) as last_article_time
        FROM feeds f
        LEFT JOIN articles a ON f.id = a.feed_id
        WHERE f.is_active = true
      `);

      return {
        overall: overallStats,
        by_category: categoryStats,
        by_language: languageStats,
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return reply.code(500).send({
        type: 'about:blank',
        title: 'Internal Server Error',
        status: 500,
        detail: 'Failed to retrieve dashboard statistics',
        instance: request.url
      });
    }
  });

  // Get real-time polling status
  app.get('/dashboard/polling-status', async (request, reply) => {
    try {
      const db = getDatabase();
      
      const activeFeeds = await db.all(`
        SELECT id, name, url, category, language, updated_at
        FROM feeds 
        WHERE is_active = true 
        ORDER BY updated_at DESC
        LIMIT 10
      `);

      return {
        status: 'healthy',
        active_feeds_count: activeFeeds.length,
        recent_activity: activeFeeds.map(feed => ({
          feed_id: feed.id,
          feed_name: feed.name,
          category: feed.category,
          language: feed.language,
          last_updated: feed.updated_at,
          status: 'active'
        }))
      };
    } catch (error) {
      console.error('Polling status error:', error);
      return reply.code(500).send({
        type: 'about:blank',
        title: 'Internal Server Error', 
        status: 500,
        detail: 'Failed to retrieve polling status',
        instance: request.url
      });
    }
  });
}