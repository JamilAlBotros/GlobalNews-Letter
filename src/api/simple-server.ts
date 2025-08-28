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

// Mock API endpoints that the frontend expects
server.get('/api/enhanced/health', async () => {
  return {
    overall_status: 'healthy',
    components: {
      database: 'healthy',
      feed_processing: 'healthy',
      translation_pipeline: 'healthy',
      health_monitoring: 'healthy',
    },
    metrics: {
      active_feeds: 12,
      total_articles: 1547,
      pending_translations: 23,
      system_uptime: '2d 14h 32m',
    },
    alerts: []
  };
});

server.get('/api/enhanced/feeds/sources', async () => {
  return [
    {
      id: 'reuters-finance-001',
      name: 'Reuters Finance',
      base_url: 'https://reuters.com',
      provider_type: 'rss',
      source_language: 'en',
      primary_region: 'us',
      content_category: 'finance',
      content_type: 'breaking',
      is_active: true,
      quality_score: 0.9,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ];
});

server.get('/api/enhanced/analytics/feeds', async () => {
  return {
    feeds_by_language: [
      { language: 'English', count: 8, success_rate: 95 },
      { language: 'Spanish', count: 3, success_rate: 92 },
    ],
    feeds_by_category: [
      { category: 'Finance', count: 6, avg_articles: 15 },
      { category: 'Tech', count: 4, avg_articles: 12 },
    ]
  };
});

server.get('/api/enhanced/analytics/translations', async () => {
  return {
    job_status_distribution: [
      { name: 'Completed', value: 156 },
      { name: 'Processing', value: 23 },
    ],
    processing_stats: {
      avg_processing_time: 1250,
      total_translations: 195,
      success_rate: 97.9,
      queue_size: 35,
    }
  };
});

// Mock articles endpoint
server.get('/api/enhanced/articles', async () => {
  return [
    {
      id: 'art-1',
      feed_instance_id: 'reuters-business-feed',
      title: 'Global Markets Rally as Tech Stocks Surge',
      description: 'Technology stocks led a broad market rally today...',
      author: 'Jane Smith',
      source_url: 'https://reuters.com/article/123',
      published_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      detected_language: 'en',
      content_category: 'finance',
      urgency_level: 'normal',
      processing_stage: 'processed',
      is_selected: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ];
});

// Mock translation jobs
server.get('/api/enhanced/translations/jobs', async () => {
  return [
    {
      id: 'job-1',
      original_article_id: 'art-1',
      target_languages: 'es,pt',
      priority: 'normal',
      status: 'completed',
      article_title: 'Global Markets Rally as Tech Stocks Surge',
      source_language: 'en',
      created_at: new Date().toISOString(),
    }
  ];
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