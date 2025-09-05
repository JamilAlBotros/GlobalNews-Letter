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
          COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as articles_last_24h,
          COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as articles_last_7d
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
          COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as articles_last_24h,
          COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as articles_last_7d
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
          COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as articles_last_24h,
          COUNT(CASE WHEN a.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as articles_last_7d,
          MAX(a.created_at) as last_article_time
        FROM feeds f
        LEFT JOIN articles a ON f.id = a.feed_id
        WHERE f.is_active = true
      `);

      // Get recent polling activity (mock data for now - would come from polling service)
      const pollingJobs = {
        active: 3,
        completed_today: 45,
        failed_today: 2,
        next_scheduled: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes from now
        last_successful: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        jobs: [
          {
            id: 'cnn-tech',
            feed_name: 'CNN Technology',
            status: 'running',
            started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
            articles_found: 5
          },
          {
            id: 'bbc-world',
            feed_name: 'BBC World News',
            status: 'completed',
            completed_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            articles_found: 12
          },
          {
            id: 'reuters-business',
            feed_name: 'Reuters Business',
            status: 'scheduled',
            scheduled_at: new Date(Date.now() + 8 * 60 * 1000).toISOString()
          }
        ]
      };

      return {
        overall: overallStats,
        by_category: categoryStats,
        by_language: languageStats,
        polling_jobs: pollingJobs,
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

  // Get real-time polling status (would integrate with actual polling service)
  app.get('/dashboard/polling-status', async (request, reply) => {
    try {
      // This would typically query your polling service/job queue
      // For now, returning mock data based on database state
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
        polling_interval: '15 minutes',
        last_poll_cycle: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        next_poll_cycle: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
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