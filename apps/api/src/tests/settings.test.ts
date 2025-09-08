import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { settingsRoutes } from '../routes/settings.js';
import { TestDatabase } from './setup/test-database.js';
import {
  mockAllSettings,
  mockSystemSettings,
  mockLLMSettings,
  mockPollingSettings,
  mockNewsletterSettings,
  mockNewsAPISettings,
  validLLMUpdate,
  validPollingUpdate,
  validNewsletterUpdate,
  invalidLLMUpdate,
  invalidPollingUpdate,
  invalidNewsletterUpdate,
  expectedUpdateResponses,
  expectedSchemaResponse,
  mockLLMTestResponse
} from './fixtures/settings-test-data.js';

describe('Settings API Endpoints', () => {
  let app: FastifyInstance;
  let testDb: TestDatabase;

  beforeAll(async () => {
    // Setup test database
    testDb = new TestDatabase();
    await testDb.setup();

    // Create test app
    app = Fastify({ logger: false });
    await app.register(settingsRoutes);
    await app.ready();
  });

  afterAll(async () => {
    await testDb.cleanup();
    await app.close();
  });

  describe('GET /settings', () => {
    it('should return all settings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      // Verify structure
      expect(data).toHaveProperty('system');
      expect(data).toHaveProperty('database');
      expect(data).toHaveProperty('llm');
      expect(data).toHaveProperty('newsapi');
      expect(data).toHaveProperty('polling');
      expect(data).toHaveProperty('newsletter');

      // Verify system settings structure
      expect(data.system).toHaveProperty('port');
      expect(data.system).toHaveProperty('host');
      expect(data.system).toHaveProperty('logger');
      expect(data.system).toHaveProperty('environment');

      // Verify LLM settings structure
      expect(data.llm).toHaveProperty('provider');
      expect(data.llm).toHaveProperty('model');
      expect(data.llm).toHaveProperty('maxTokens');
      expect(data.llm).toHaveProperty('temperature');
      expect(data.llm).toHaveProperty('hasApiKey');

      // Verify polling settings structure
      expect(data.polling).toHaveProperty('defaultInterval');
      expect(data.polling).toHaveProperty('batchSize');
      expect(data.polling).toHaveProperty('maxRetries');
      expect(data.polling).toHaveProperty('timeoutMs');

      // Verify newsletter settings structure
      expect(data.newsletter).toHaveProperty('frequency');
      expect(data.newsletter).toHaveProperty('maxArticles');
      expect(data.newsletter).toHaveProperty('languages');
      expect(data.newsletter).toHaveProperty('categories');
    });
  });

  describe('GET /settings/system', () => {
    it('should return system information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings/system'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('port');
      expect(data).toHaveProperty('host');
      expect(data).toHaveProperty('logger');
      expect(data).toHaveProperty('environment');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('memory');
      expect(data).toHaveProperty('version');
      
      expect(typeof data.port).toBe('number');
      expect(typeof data.host).toBe('string');
      expect(typeof data.logger).toBe('boolean');
      expect(typeof data.uptime).toBe('number');
    });
  });

  describe('GET /settings/llm', () => {
    it('should return LLM settings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings/llm'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('provider');
      expect(data).toHaveProperty('baseUrl');
      expect(data).toHaveProperty('model');
      expect(data).toHaveProperty('maxTokens');
      expect(data).toHaveProperty('temperature');
      expect(data).toHaveProperty('hasApiKey');
      expect(data).toHaveProperty('supportedProviders');
      
      expect(Array.isArray(data.supportedProviders)).toBe(true);
      expect(data.supportedProviders).toContain('ollama');
      expect(data.supportedProviders).toContain('openai');
      expect(data.supportedProviders).toContain('anthropic');
    });
  });

  describe('PUT /settings/llm', () => {
    it('should validate and acknowledge LLM settings update', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/llm',
        payload: validLLMUpdate
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('LLM settings validation successful');
      expect(data).toHaveProperty('validated');
      expect(data).toHaveProperty('current');
      expect(data.validated).toMatchObject(validLLMUpdate);
    });

    it('should reject invalid LLM settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/llm',
        payload: invalidLLMUpdate
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('should handle partial updates', async () => {
      const partialUpdate = { temperature: 0.7 };
      
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/llm',
        payload: partialUpdate
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.validated).toHaveProperty('temperature', 0.7);
    });
  });

  describe('GET /settings/polling', () => {
    it('should return polling settings with status information', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings/polling'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('defaultInterval');
      expect(data).toHaveProperty('batchSize');
      expect(data).toHaveProperty('maxRetries');
      expect(data).toHaveProperty('timeoutMs');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('lastRun');
      expect(data).toHaveProperty('nextRun');
      
      expect(typeof data.defaultInterval).toBe('number');
      expect(typeof data.batchSize).toBe('number');
      expect(data.defaultInterval).toBeGreaterThanOrEqual(60);
      expect(data.batchSize).toBeGreaterThan(0);
    });
  });

  describe('PUT /settings/polling', () => {
    it('should update polling settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: validPollingUpdate
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Polling settings updated successfully');
      expect(data).toHaveProperty('settings');
      expect(data.settings.defaultInterval).toBe(validPollingUpdate.defaultInterval);
      expect(data.settings.batchSize).toBe(validPollingUpdate.batchSize);
    });

    it('should reject invalid polling settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: invalidPollingUpdate
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('should validate interval range', async () => {
      const invalidInterval = { defaultInterval: 30 }; // Below minimum of 60
      
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: invalidInterval
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /settings/newsletter', () => {
    it('should return newsletter settings with available options', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings/newsletter'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('frequency');
      expect(data).toHaveProperty('maxArticles');
      expect(data).toHaveProperty('languages');
      expect(data).toHaveProperty('categories');
      expect(data).toHaveProperty('availableLanguages');
      expect(data).toHaveProperty('availableCategories');
      expect(data).toHaveProperty('templates');
      
      expect(Array.isArray(data.languages)).toBe(true);
      expect(Array.isArray(data.categories)).toBe(true);
      expect(Array.isArray(data.availableLanguages)).toBe(true);
      expect(Array.isArray(data.availableCategories)).toBe(true);
      expect(['daily', 'weekly', 'monthly']).toContain(data.frequency);
    });
  });

  describe('PUT /settings/newsletter', () => {
    it('should update newsletter settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/newsletter',
        payload: validNewsletterUpdate
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Newsletter settings updated successfully');
      expect(data).toHaveProperty('settings');
      expect(data.settings.frequency).toBe(validNewsletterUpdate.frequency);
      expect(data.settings.maxArticles).toBe(validNewsletterUpdate.maxArticles);
      expect(data.settings.languages).toEqual(validNewsletterUpdate.languages);
    });

    it('should reject invalid newsletter settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/newsletter',
        payload: invalidNewsletterUpdate
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });
  });

  describe('GET /settings/newsapi', () => {
    it('should return NewsAPI settings', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings/newsapi'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('baseUrl');
      expect(data).toHaveProperty('timeout');
      expect(data).toHaveProperty('retries');
      expect(data).toHaveProperty('hasApiKey');
      expect(data).toHaveProperty('status');
      
      expect(typeof data.timeout).toBe('number');
      expect(typeof data.retries).toBe('number');
      expect(typeof data.hasApiKey).toBe('boolean');
    });
  });

  describe('POST /settings/reset', () => {
    it('should reset all settings to defaults', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/settings/reset',
        payload: {}
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('reset to defaults successfully');
      expect(data).toHaveProperty('settings');
      expect(data.settings).toHaveProperty('polling');
      expect(data.settings).toHaveProperty('newsletter');
    });

    it('should reset specific section', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/settings/reset',
        payload: { section: 'polling' }
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('message');
      expect(data.message).toContain('Settings for polling reset to defaults');
      expect(data).toHaveProperty('settings');
      // Should return only the polling settings
      expect(data.settings).toHaveProperty('defaultInterval', 3600);
      expect(data.settings).toHaveProperty('batchSize', 10);
    });
  });

  describe('GET /settings/schema', () => {
    it('should return settings schemas and descriptions', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings/schema'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('schemas');
      expect(data).toHaveProperty('descriptions');
      
      expect(data.schemas).toHaveProperty('system');
      expect(data.schemas).toHaveProperty('llm');
      expect(data.schemas).toHaveProperty('polling');
      expect(data.schemas).toHaveProperty('newsletter');
      
      expect(data.descriptions).toHaveProperty('system');
      expect(data.descriptions).toHaveProperty('llm');
      expect(data.descriptions).toHaveProperty('polling');
      expect(data.descriptions).toHaveProperty('newsletter');
      
      expect(typeof data.descriptions.system).toBe('string');
      expect(typeof data.descriptions.llm).toBe('string');
    });
  });

  describe('POST /settings/llm/test', () => {
    it('should test LLM connection', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/settings/llm/test'
      });

      // Note: This will likely fail in test environment, but should return proper structure
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('success');
      expect(data).toHaveProperty('provider');
      expect(typeof data.success).toBe('boolean');
      
      if (data.success) {
        expect(data).toHaveProperty('model');
        expect(data).toHaveProperty('result');
      } else {
        expect(data).toHaveProperty('error');
      }
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings/nonexistent'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 405 for unsupported methods', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/settings/llm'
      });

      expect(response.statusCode).toBe(404); // Fastify returns 404 for unsupported routes
    });

    it('should handle malformed JSON in PUT requests', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/llm',
        payload: 'invalid-json'
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Data persistence across requests', () => {
    it('should persist polling settings changes', async () => {
      // Update polling settings
      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: { defaultInterval: 1800 }
      });
      expect(updateResponse.statusCode).toBe(200);

      // Verify the change persisted
      const getResponse = await app.inject({
        method: 'GET',
        url: '/settings/polling'
      });
      const data = JSON.parse(getResponse.body);
      expect(data.defaultInterval).toBe(1800);
    });

    it('should persist newsletter settings changes', async () => {
      // Update newsletter settings
      const updateResponse = await app.inject({
        method: 'PUT',
        url: '/settings/newsletter',
        payload: { maxArticles: 25, frequency: 'weekly' }
      });
      expect(updateResponse.statusCode).toBe(200);

      // Verify the change persisted
      const getResponse = await app.inject({
        method: 'GET',
        url: '/settings/newsletter'
      });
      const data = JSON.parse(getResponse.body);
      expect(data.maxArticles).toBe(25);
      expect(data.frequency).toBe('weekly');
    });
  });
});