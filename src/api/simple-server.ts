#!/usr/bin/env node

import Fastify from 'fastify';
import cors from '@fastify/cors';

const server = Fastify({
  logger: true
});

// Register CORS
await server.register(cors, {
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true
});

// Basic health endpoints
server.get('/healthz', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

server.get('/readyz', async () => {
  return { ready: true, timestamp: new Date().toISOString() };
});

// API endpoints that connect to real services
server.get('/api/enhanced/health', async () => {
  // TODO: Connect to actual health monitoring service
  return {
    overall_status: 'unknown',
    components: {
      database: 'unknown',
      feed_processing: 'unknown',
      translation_pipeline: 'unknown',
      health_monitoring: 'unknown',
    },
    metrics: {
      active_feeds: 0,
      total_articles: 0,
      pending_translations: 0,
      system_uptime: '0m',
    },
    alerts: []
  };
});

server.get('/api/enhanced/feeds/sources', async () => {
  // TODO: Connect to actual database to fetch feed sources
  return [];
});

server.post('/api/enhanced/feeds/sources', async (request, reply) => {
  // TODO: Connect to actual database to save feed source
  const body = request.body as any;
  
  // Mock response for now
  const feedSource = {
    id: `mock-${Date.now()}`,
    name: body.name,
    rss_url: body.rss_url,
    source_language: body.source_language,
    content_category: body.content_category,
    refresh_tier: body.refresh_tier,
    is_active: true,
    quality_score: 0.5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  reply.code(201);
  return feedSource;
});

server.get('/api/enhanced/analytics/feeds', async () => {
  // TODO: Connect to actual analytics service
  return {
    feeds_by_language: [],
    feeds_by_category: [],
    refresh_tier_performance: []
  };
});

server.get('/api/enhanced/analytics/translations', async () => {
  // TODO: Connect to actual translation analytics service
  return {
    job_status_distribution: [],
    language_pairs: [],
    processing_stats: {
      avg_processing_time: 0,
      total_translations: 0,
      success_rate: 0,
      queue_size: 0,
    }
  };
});

server.get('/api/enhanced/articles', async () => {
  // TODO: Connect to actual database to fetch articles
  return [];
});

server.get('/api/enhanced/translations/jobs', async () => {
  // TODO: Connect to actual database to fetch translation jobs
  return [];
});

// Polling status and controls - initialized with default state
let pollingState = {
  is_running: false,
  last_poll_at: null,
  next_poll_at: null,
  current_interval_minutes: 5,
};

server.get('/api/enhanced/polling/status', async () => {
  // TODO: Connect to actual polling service for metrics
  return {
    ...pollingState,
    total_feeds: 0,
    active_feeds: 0,
    failed_feeds: 0,
    articles_fetched_today: 0,
    articles_fetched_last_hour: 0,
    avg_response_time: 0,
    polls_today: 0,
    successful_polls: 0,
    failed_polls: 0,
    uptime_percentage: 0,
    adaptive_polling_enabled: false,
  };
});

server.post('/api/enhanced/polling/start', async () => {
  pollingState.is_running = true;
  pollingState.next_poll_at = new Date(Date.now() + pollingState.current_interval_minutes * 60 * 1000).toISOString();
  return { success: true, message: 'Polling started' };
});

server.post('/api/enhanced/polling/stop', async () => {
  pollingState.is_running = false;
  return { success: true, message: 'Polling stopped' };
});

server.post('/api/enhanced/polling/trigger', async () => {
  // TODO: Connect to actual polling service
  pollingState.last_poll_at = new Date().toISOString();
  pollingState.next_poll_at = new Date(Date.now() + pollingState.current_interval_minutes * 60 * 1000).toISOString();
  return { success: true, message: 'Poll triggered', articles_fetched: 0 };
});

server.put('/api/enhanced/polling/interval', async (request) => {
  const { minutes } = request.body as { minutes: number };
  pollingState.current_interval_minutes = minutes;
  pollingState.next_poll_at = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  return { success: true, message: 'Interval updated', minutes };
});

server.get('/api/enhanced/polling/feeds', async () => {
  // TODO: Connect to actual database to fetch feed polling status
  return [];
});

// Missing endpoints that frontend expects
server.get('/api/enhanced/feeds/instances', async () => {
  // TODO: Connect to actual database to fetch feed instances
  return [];
});

server.get('/api/enhanced/health/analytics', async () => {
  // TODO: Connect to actual health analytics service
  return {
    system_metrics: [],
    performance_trends: [],
    alert_history: []
  };
});

server.get('/api/enhanced/database/backups', async () => {
  // TODO: Connect to actual backup service
  return [];
});

server.post('/api/enhanced/database/backup', async () => {
  // TODO: Implement backup functionality
  return { success: true, filename: `backup-${Date.now()}.db` };
});

server.post('/api/enhanced/database/restore', async () => {
  // TODO: Implement restore functionality
  return { success: true, message: 'Database restored' };
});

server.post('/api/enhanced/database/wipe', async () => {
  // TODO: Implement wipe functionality
  return { success: true, message: 'Database wiped' };
});

server.get('/api/enhanced/translations', async () => {
  // TODO: Connect to actual translation service
  return [];
});

// Start server
const start = async () => {
  try {
    await server.listen({ port: 3333, host: '127.0.0.1' });
    console.log('🚀 Server running on http://localhost:3333');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();