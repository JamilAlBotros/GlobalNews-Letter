import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { TestDatabase } from './setup/test-database.js';
import { MockSettingsStore } from './mocks/settings-store.js';
import {
  mockSystemSettings,
  mockLLMSettings,
  validLLMUpdate,
  validPollingUpdate,
  validNewsletterUpdate,
  invalidLLMUpdate,
  invalidPollingUpdate,
  invalidNewsletterUpdate
} from './fixtures/settings-test-data.js';

// Mock the settings routes to use our mock store instead of the real one
let mockSettingsStore: MockSettingsStore;
let originalConsoleError: typeof console.error;

describe('Settings API Endpoints (Clean Tests)', () => {
  let app: FastifyInstance;
  let testDb: TestDatabase;

  beforeAll(async () => {
    // Setup test database
    testDb = new TestDatabase();
    await testDb.setup();

    // Initialize mock settings store
    mockSettingsStore = new MockSettingsStore();

    // Mock console.error to suppress error logs during testing
    originalConsoleError = console.error;
    console.error = vi.fn();

    // Create test app with mocked settings routes
    app = Fastify({ logger: false });
    
    // Register mocked settings routes
    await app.register(async function mockSettingsRoutes(fastify) {
      // Mock settings endpoints that use our test store
      
      // Get all settings
      fastify.get("/settings", async () => {
        const settings = mockSettingsStore.getSettings();
        return {
          system: mockSystemSettings,
          database: {
            url: "./data/test.db",
            logging: true
          },
          llm: mockLLMSettings,
          newsapi: {
            baseUrl: "https://newsapi.org/v2",
            timeout: 30000,
            retries: 3,
            hasApiKey: false,
            status: "not_configured"
          },
          polling: {
            ...settings.polling,
            status: "active",
            lastRun: "2025-01-15T10:30:00.000Z",
            nextRun: "2025-01-15T11:30:00.000Z"
          },
          newsletter: {
            ...settings.newsletter,
            availableLanguages: ["en", "es", "fr", "de", "pt", "it"],
            availableCategories: ["world", "technology", "business", "health", "sports", "entertainment"],
            templates: ["default", "minimal", "detailed"]
          }
        };
      });

      // Get system settings
      fastify.get("/settings/system", async () => mockSystemSettings);

      // Get LLM settings
      fastify.get("/settings/llm", async () => ({
        ...mockLLMSettings,
        supportedProviders: ["openai", "anthropic", "ollama", "mock"]
      }));

      // Update LLM settings (validation only, no persistence)
      fastify.put("/settings/llm", async (request) => {
        const { z } = await import('zod');
        
        const LLMSettingsSchema = z.object({
          provider: z.enum(['openai', 'anthropic', 'ollama', 'mock']).optional(),
          apiKey: z.string().optional(),
          baseUrl: z.string().url().optional(),
          model: z.string().min(1).optional(),
          maxTokens: z.number().min(1).max(8192).optional(),
          temperature: z.number().min(0).max(2).optional(),
          mockInDev: z.boolean().optional()
        });

        try {
          const input = LLMSettingsSchema.parse(request.body);
          return {
            message: "LLM settings validation successful. Note: Changes require server restart to take effect.",
            validated: input,
            current: mockLLMSettings
          };
        } catch (error: any) {
          const reply = request.server.reply();
          return reply.code(400).type("application/problem+json").send({
            type: "about:blank",
            title: "Invalid LLM settings",
            status: 400,
            detail: error.message,
            instance: request.url
          });
        }
      });

      // Get polling settings
      fastify.get("/settings/polling", async () => {
        const settings = mockSettingsStore.getSettings();
        return {
          ...settings.polling,
          status: "active",
          lastRun: "2025-01-15T10:30:00.000Z",
          nextRun: "2025-01-15T11:30:00.000Z"
        };
      });

      // Update polling settings (mock persistence)
      fastify.put("/settings/polling", async (request) => {
        const { z } = await import('zod');
        
        const PollingSettingsSchema = z.object({
          defaultInterval: z.number().min(60).max(86400).optional(),
          batchSize: z.number().min(1).max(100).optional(),
          maxRetries: z.number().min(0).max(10).optional(),
          timeoutMs: z.number().min(5000).max(300000).optional()
        });

        try {
          const input = PollingSettingsSchema.parse(request.body);
          const updatedSettings = mockSettingsStore.updatePollingSettings(input);
          
          return {
            message: "Polling settings updated successfully",
            settings: updatedSettings
          };
        } catch (error: any) {
          const reply = request.server.reply();
          return reply.code(400).type("application/problem+json").send({
            type: "about:blank",
            title: "Invalid polling settings",
            status: 400,
            detail: error.message,
            instance: request.url
          });
        }
      });

      // Get newsletter settings
      fastify.get("/settings/newsletter", async () => {
        const settings = mockSettingsStore.getSettings();
        return {
          ...settings.newsletter,
          availableLanguages: ["en", "es", "fr", "de", "pt", "it"],
          availableCategories: ["world", "technology", "business", "health", "sports", "entertainment"],
          templates: ["default", "minimal", "detailed"]
        };
      });

      // Update newsletter settings (mock persistence)
      fastify.put("/settings/newsletter", async (request) => {
        const { z } = await import('zod');
        
        const NewsletterSettingsSchema = z.object({
          frequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
          maxArticles: z.number().min(1).max(50).optional(),
          languages: z.array(z.string()).optional(),
          categories: z.array(z.string()).optional(),
          emailTemplate: z.string().optional()
        });

        try {
          const input = NewsletterSettingsSchema.parse(request.body);
          const updatedSettings = mockSettingsStore.updateNewsletterSettings(input);
          
          return {
            message: "Newsletter settings updated successfully",
            settings: updatedSettings
          };
        } catch (error: any) {
          const reply = request.server.reply();
          return reply.code(400).type("application/problem+json").send({
            type: "about:blank",
            title: "Invalid newsletter settings",
            status: 400,
            detail: error.message,
            instance: request.url
          });
        }
      });

      // Reset settings (mock reset)
      fastify.post("/settings/reset", async (request) => {
        const { section } = request.body as { section?: string };
        const resetSettings = mockSettingsStore.reset(section as 'polling' | 'newsletter');
        
        return {
          message: `Settings ${section ? `for ${section}` : ''} reset to defaults successfully`,
          settings: resetSettings
        };
      });

      // Get NewsAPI settings
      fastify.get("/settings/newsapi", async () => ({
        baseUrl: "https://newsapi.org/v2",
        timeout: 30000,
        retries: 3,
        hasApiKey: false,
        status: "not_configured"
      }));

      // Test LLM connection (mock)
      fastify.post("/settings/llm/test", async () => ({
        success: true,
        provider: "ollama",
        model: "mistral",
        result: "Mock connection successful"
      }));

      // Get settings schema
      fastify.get("/settings/schema", async () => ({
        schemas: {
          system: {},
          llm: {},
          newsapi: {},
          polling: {},
          newsletter: {}
        },
        descriptions: {
          system: "Core server configuration settings",
          llm: "Language model integration settings",
          newsapi: "News API service configuration",
          polling: "RSS feed polling and processing settings",
          newsletter: "Newsletter generation and delivery settings"
        }
      }));
    });

    await app.ready();
  });

  afterAll(async () => {
    // Cleanup
    mockSettingsStore.cleanup();
    await testDb.cleanup();
    await app.close();
    
    // Restore console.error
    console.error = originalConsoleError;
  });

  beforeEach(async () => {
    // Reset mock settings before each test
    mockSettingsStore.reset();
  });

  describe('GET /settings', () => {
    it('should return all settings without persisting data', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/settings'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data).toHaveProperty('system');
      expect(data).toHaveProperty('database');
      expect(data).toHaveProperty('llm');
      expect(data).toHaveProperty('newsapi');
      expect(data).toHaveProperty('polling');
      expect(data).toHaveProperty('newsletter');
      
      expect(data.system.port).toBe(mockSystemSettings.port);
      expect(data.llm.provider).toBe(mockLLMSettings.provider);
    });
  });

  describe('PUT /settings/polling - Clean Tests', () => {
    it('should validate and mock update polling settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: validPollingUpdate
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.message).toContain('Polling settings updated successfully');
      expect(data.settings.defaultInterval).toBe(validPollingUpdate.defaultInterval);
      expect(data.settings.batchSize).toBe(validPollingUpdate.batchSize);
    });

    it('should reject invalid polling settings with proper validation', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: invalidPollingUpdate
      });

      expect(response.statusCode).toBe(400);
      expect(response.headers['content-type']).toContain('application/problem+json');
    });

    it('should reset polling settings without persistence', async () => {
      // First, update settings
      await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: { defaultInterval: 1800 }
      });

      // Verify the change
      let response = await app.inject({
        method: 'GET',
        url: '/settings/polling'
      });
      let data = JSON.parse(response.body);
      expect(data.defaultInterval).toBe(1800);

      // Reset settings
      response = await app.inject({
        method: 'POST',
        url: '/settings/reset',
        payload: { section: 'polling' }
      });

      expect(response.statusCode).toBe(200);
      data = JSON.parse(response.body);
      expect(data.settings.polling.defaultInterval).toBe(3600); // Default value
    });
  });

  describe('PUT /settings/newsletter - Clean Tests', () => {
    it('should validate and mock update newsletter settings', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/newsletter',
        payload: validNewsletterUpdate
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.message).toContain('Newsletter settings updated successfully');
      expect(data.settings.frequency).toBe(validNewsletterUpdate.frequency);
      expect(data.settings.maxArticles).toBe(validNewsletterUpdate.maxArticles);
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

  describe('PUT /settings/llm - Clean Tests', () => {
    it('should validate LLM settings without persistence', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/llm',
        payload: validLLMUpdate
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      expect(data.message).toContain('LLM settings validation successful');
      expect(data.validated).toMatchObject(validLLMUpdate);
      expect(data.current).toMatchObject(mockLLMSettings);
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
  });

  describe('Test Isolation', () => {
    it('should isolate test changes between tests', async () => {
      // Update polling settings in first test
      await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: { defaultInterval: 1800 }
      });

      // Verify change
      let response = await app.inject({
        method: 'GET',
        url: '/settings/polling'
      });
      let data = JSON.parse(response.body);
      expect(data.defaultInterval).toBe(1800);
    });

    it('should start fresh for each test (previous test should not affect this one)', async () => {
      // This should start with default settings, not the modified ones from previous test
      const response = await app.inject({
        method: 'GET',
        url: '/settings/polling'
      });

      const data = JSON.parse(response.body);
      expect(data.defaultInterval).toBe(3600); // Default value, not 1800 from previous test
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: 'invalid-json'
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return proper error structure', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/settings/polling',
        payload: { defaultInterval: 30 } // Too low
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data).toHaveProperty('type');
      expect(data).toHaveProperty('title');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('detail');
    });
  });

  describe('Mock Data Integrity', () => {
    it('should return consistent mock data', async () => {
      const response1 = await app.inject({ method: 'GET', url: '/settings/system' });
      const response2 = await app.inject({ method: 'GET', url: '/settings/system' });

      expect(response1.body).toBe(response2.body);
      expect(JSON.parse(response1.body)).toEqual(mockSystemSettings);
    });

    it('should provide test LLM connection', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/settings/llm/test'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
      expect(data.result).toBe('Mock connection successful');
    });
  });
});