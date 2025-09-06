import { FastifyPluginAsync } from 'fastify';
import { googleRSSFeedRepository, CreateGoogleRSSFeedInput, UpdateGoogleRSSFeedInput } from '../repositories/google-rss-feeds.js';
import { RSSProvider } from '../services/rss-provider.js';
import crypto from 'crypto';

// Google News topics with their IDs
const GOOGLE_TOPICS = {
  World: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB',
  Business: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB',
  Technology: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVA',
  Science: 'CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp0Y1RjU0FtVnVHZ0pWVXlnQVAB'
} as const;

const COUNTRIES = {
  'United States': 'US',
  'United Kingdom': 'GB',
  'France': 'FR',
  'Germany': 'DE',
  'Spain': 'ES',
  'Brazil': 'BR',
  'Canada': 'CA',
  'Australia': 'AU'
} as const;

const LANGUAGES = {
  'English': 'en',
  'French': 'fr',
  'German': 'de',
  'Spanish': 'es',
  'Portuguese': 'pt'
} as const;

const TIME_FRAMES = {
  'Last hour': '1h',
  'Last 24 hours': '24h',
  'Last 7 days': '7d',
  'Last 30 days': '30d',
  'Last year': '1y'
} as const;

function generateTopicRSSUrl(topicId: string, countryCode: string, langCode: string): string {
  return `https://news.google.com/rss/topics/${topicId}?hl=${langCode}&gl=${countryCode}&ceid=${countryCode}:${langCode}`;
}

function generateSearchRSSUrl(query: string, timeFrame: string, countryCode: string, langCode: string): string {
  const encodedQuery = encodeURIComponent(`${query} when:${timeFrame}`);
  return `https://news.google.com/rss/search?q=${encodedQuery}&hl=${langCode}&gl=${countryCode}&ceid=${countryCode}:${langCode}`;
}

export const googleRSSFeedRoutes: FastifyPluginAsync = async (fastify) => {
  const rssProvider = new RSSProvider();

  // Get all Google RSS feeds
  fastify.get('/google-rss-feeds', async (request, reply) => {
    try {
      const { limit = 50, offset = 0, mode } = request.query as any;
      
      let feeds;
      if (mode && (mode === 'topic' || mode === 'search')) {
        feeds = await googleRSSFeedRepository.findByMode(mode, limit);
      } else {
        feeds = await googleRSSFeedRepository.findAll(limit, offset);
      }
      
      return feeds;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get Google RSS feed by ID
  fastify.get('/google-rss-feeds/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const feed = await googleRSSFeedRepository.findById(id);
      
      if (!feed) {
        return reply.code(404).send({ error: 'Google RSS feed not found' });
      }
      
      return feed;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get Google RSS feed statistics
  fastify.get('/google-rss-feeds-stats', async (request, reply) => {
    try {
      const stats = await googleRSSFeedRepository.getStats();
      return stats;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Get available topics, countries, languages, and time frames
  fastify.get('/google-rss-config', async (request, reply) => {
    return {
      topics: Object.keys(GOOGLE_TOPICS),
      countries: Object.keys(COUNTRIES),
      languages: Object.keys(LANGUAGES),
      timeFrames: Object.keys(TIME_FRAMES)
    };
  });

  // Generate Google RSS URL
  fastify.post('/google-rss-generate-url', async (request, reply) => {
    try {
      const body = request.body as {
        mode: 'topic' | 'search';
        topic?: string;
        searchQuery?: string;
        timeFrame?: string;
        country: string;
        language: string;
      };

      const countryCode = COUNTRIES[body.country as keyof typeof COUNTRIES];
      const langCode = LANGUAGES[body.language as keyof typeof LANGUAGES];

      if (!countryCode || !langCode) {
        return reply.code(400).send({ error: 'Invalid country or language' });
      }

      let url: string;

      if (body.mode === 'topic' && body.topic) {
        const topicId = GOOGLE_TOPICS[body.topic as keyof typeof GOOGLE_TOPICS];
        if (!topicId) {
          return reply.code(400).send({ error: 'Invalid topic' });
        }
        url = generateTopicRSSUrl(topicId, countryCode, langCode);
      } else if (body.mode === 'search' && body.searchQuery && body.timeFrame) {
        const timeFrameCode = TIME_FRAMES[body.timeFrame as keyof typeof TIME_FRAMES];
        if (!timeFrameCode) {
          return reply.code(400).send({ error: 'Invalid time frame' });
        }
        url = generateSearchRSSUrl(body.searchQuery, timeFrameCode, countryCode, langCode);
      } else {
        return reply.code(400).send({ error: 'Invalid mode or missing required fields' });
      }

      return { url };
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Test Google RSS feed URL
  fastify.post('/google-rss-test-url', async (request, reply) => {
    try {
      const { url } = request.body as { url: string };

      if (!url) {
        return reply.code(400).send({ error: 'URL is required' });
      }

      // Validate the feed
      const validation = await rssProvider.validateFeedUrl(url);
      
      if (!validation.isValid) {
        return {
          isValid: false,
          error: validation.error,
          url
        };
      }

      // Fetch sample articles
      const { articles, metadata } = await rssProvider.fetchFeed(url);
      
      return {
        isValid: true,
        url,
        articleCount: articles.length,
        feedTitle: metadata.title || 'N/A',
        sampleArticles: articles.slice(0, 3).map(article => ({
          title: article.title,
          link: article.link,
          publishedAt: article.publishedAt
        }))
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: error.message,
        url: (request.body as { url?: string })?.url
      };
    }
  });

  // Create Google RSS feed
  fastify.post('/google-rss-feeds', async (request, reply) => {
    try {
      const body = request.body as CreateGoogleRSSFeedInput;
      
      // Validate required fields
      if (!body.name || !body.url || !body.mode || !body.country || !body.language) {
        return reply.code(400).send({ error: 'Missing required fields' });
      }

      // Test the feed before creating
      const validation = await rssProvider.validateFeedUrl(body.url);
      if (!validation.isValid) {
        return reply.code(400).send({ 
          error: `RSS feed validation failed: ${validation.error}` 
        });
      }

      const id = await googleRSSFeedRepository.create(body);
      
      // Mark as validated since we just tested it
      await googleRSSFeedRepository.validateFeed(id);
      
      const createdFeed = await googleRSSFeedRepository.findById(id);
      return createdFeed;
    } catch (error: any) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return reply.code(409).send({ error: 'RSS feed URL already exists' });
      }
      reply.code(500).send({ error: error.message });
    }
  });

  // Update Google RSS feed
  fastify.put('/google-rss-feeds/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as UpdateGoogleRSSFeedInput;
      
      const updated = await googleRSSFeedRepository.update(id, body);
      
      if (!updated) {
        return reply.code(404).send({ error: 'Google RSS feed not found' });
      }
      
      const updatedFeed = await googleRSSFeedRepository.findById(id);
      return updatedFeed;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Delete Google RSS feed
  fastify.delete('/google-rss-feeds/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const deleted = await googleRSSFeedRepository.delete(id);
      
      if (!deleted) {
        return reply.code(404).send({ error: 'Google RSS feed not found' });
      }
      
      return { success: true };
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Toggle feed active status
  fastify.post('/google-rss-feeds/:id/toggle', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const feed = await googleRSSFeedRepository.findById(id);
      if (!feed) {
        return reply.code(404).send({ error: 'Google RSS feed not found' });
      }
      
      await googleRSSFeedRepository.update(id, { is_active: !feed.is_active });
      
      const updatedFeed = await googleRSSFeedRepository.findById(id);
      return updatedFeed;
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });

  // Validate and update feed status
  fastify.post('/google-rss-feeds/:id/validate', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      
      const feed = await googleRSSFeedRepository.findById(id);
      if (!feed) {
        return reply.code(404).send({ error: 'Google RSS feed not found' });
      }
      
      // Test the feed
      const validation = await rssProvider.validateFeedUrl(feed.url);
      
      if (!validation.isValid) {
        await googleRSSFeedRepository.update(id, { is_validated: false });
        return {
          isValid: false,
          error: validation.error
        };
      }

      // Fetch current article count
      const { articles } = await rssProvider.fetchFeed(feed.url);
      
      await googleRSSFeedRepository.update(id, { 
        is_validated: true,
        article_count: articles.length,
        last_scraped: new Date().toISOString()
      });
      
      const updatedFeed = await googleRSSFeedRepository.findById(id);
      return {
        isValid: true,
        feed: updatedFeed,
        articleCount: articles.length
      };
    } catch (error: any) {
      reply.code(500).send({ error: error.message });
    }
  });
};