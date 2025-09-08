import { FastifyInstance } from "fastify";
import { z } from "zod";
import { serverConfig, databaseConfig, llmConfig, newsApiConfig } from "../config/environment.js";
import { pollingScheduler } from "../services/polling-scheduler.js";

// Zod schemas for validation
const SystemSettingsSchema = z.object({
  port: z.number().min(1000).max(65535),
  host: z.string(),
  logger: z.boolean()
});

const LLMSettingsSchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'ollama', 'mock']),
  apiKey: z.string().optional(),
  baseUrl: z.string().url(),
  model: z.string().min(1),
  maxTokens: z.number().min(1).max(8192),
  temperature: z.number().min(0).max(2),
});

const NewsAPISettingsSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url(),
  timeout: z.number().min(1000),
  retries: z.number().min(0).max(10)
});

const PollingSettingsSchema = z.object({
  defaultInterval: z.number().min(60).max(86400), // 1 minute to 24 hours
  batchSize: z.number().min(1).max(100),
  maxRetries: z.number().min(0).max(10),
  timeoutMs: z.number().min(5000).max(300000), // 5 seconds to 5 minutes
  maxConcurrentJobs: z.number().min(1).max(50), // 1 to 50 concurrent jobs
  checkIntervalMs: z.number().min(5000).max(300000) // 5 seconds to 5 minutes
});

const NewsletterSettingsSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  maxArticles: z.number().min(1).max(50),
  languages: z.array(z.string()),
  categories: z.array(z.string()),
  emailTemplate: z.string().optional()
});

// In-memory storage for runtime settings (in production, this would be in database)
let runtimeSettings: {
  polling: {
    defaultInterval: number;
    batchSize: number;
    maxRetries: number;
    timeoutMs: number;
    maxConcurrentJobs: number;
    checkIntervalMs: number;
  };
  newsletter: {
    frequency: 'daily' | 'weekly' | 'monthly';
    maxArticles: number;
    languages: string[];
    categories: string[];
    emailTemplate: string;
  };
} = {
  polling: {
    defaultInterval: 3600, // 1 hour
    batchSize: 10,
    maxRetries: 3,
    timeoutMs: 30000,
    maxConcurrentJobs: 3, // Current default
    checkIntervalMs: 30000 // Current default (30 seconds)
  },
  newsletter: {
    frequency: 'daily',
    maxArticles: 20,
    languages: ['en'],
    categories: ['world', 'technology'],
    emailTemplate: 'default'
  }
};

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // Get all settings
  app.get("/settings", async (request, reply) => {
    return {
      system: {
        port: serverConfig.port,
        host: serverConfig.host,
        logger: serverConfig.logger,
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        url: databaseConfig.url.replace(/\/[^/]*\.db$/, '/[database].db'), // Hide sensitive path details
        logging: databaseConfig.logging
      },
      llm: {
        provider: llmConfig.provider,
        baseUrl: llmConfig.baseUrl,
        model: llmConfig.model,
        maxTokens: llmConfig.maxTokens,
        temperature: llmConfig.temperature,
        hasApiKey: !!llmConfig.apiKey
      },
      newsapi: {
        baseUrl: newsApiConfig.baseUrl,
        timeout: newsApiConfig.timeout,
        retries: newsApiConfig.retries,
        hasApiKey: !!newsApiConfig.apiKey
      },
      polling: runtimeSettings.polling,
      newsletter: runtimeSettings.newsletter
    };
  });

  // Get system settings only
  app.get("/settings/system", async (request, reply) => {
    return {
      port: serverConfig.port,
      host: serverConfig.host,
      logger: serverConfig.logger,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version
    };
  });

  // Get LLM settings
  app.get("/settings/llm", async (request, reply) => {
    return {
      provider: llmConfig.provider,
      baseUrl: llmConfig.baseUrl,
      model: llmConfig.model,
      maxTokens: llmConfig.maxTokens,
      temperature: llmConfig.temperature,
      hasApiKey: !!llmConfig.apiKey,
      supportedProviders: ['openai', 'anthropic', 'ollama', 'mock']
    };
  });

  // Update LLM settings (runtime only - requires restart for env vars)
  app.put("/settings/llm", async (request, reply) => {
    try {
      const input = LLMSettingsSchema.partial().parse(request.body);
      
      // In a real implementation, you'd update environment or config file
      // For now, just validate and return current settings
      return reply.code(200).send({
        message: "LLM settings validation successful. Note: Changes require server restart to take effect.",
        validated: input,
        current: {
          provider: llmConfig.provider,
          baseUrl: llmConfig.baseUrl,
          model: llmConfig.model,
          maxTokens: llmConfig.maxTokens,
          temperature: llmConfig.temperature,
        }
      });
    } catch (error: any) {
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
  app.get("/settings/polling", async (request, reply) => {
    return {
      ...runtimeSettings.polling,
      status: 'active', // TODO: Get from polling scheduler
      lastRun: new Date().toISOString(), // TODO: Get from scheduler
      nextRun: new Date(Date.now() + runtimeSettings.polling.defaultInterval * 1000).toISOString()
    };
  });

  // Update polling settings
  app.put("/settings/polling", async (request, reply) => {
    try {
      const input = PollingSettingsSchema.partial().parse(request.body);
      
      // Update runtime settings
      runtimeSettings.polling = {
        ...runtimeSettings.polling,
        ...input
      };

      // Update polling scheduler configuration if relevant settings changed
      if (input.maxConcurrentJobs !== undefined || input.checkIntervalMs !== undefined) {
        pollingScheduler.updateConfiguration({
          maxConcurrentJobs: input.maxConcurrentJobs,
          checkIntervalMs: input.checkIntervalMs
        });
      }
      
      return {
        message: "Polling settings updated successfully",
        settings: runtimeSettings.polling,
        scheduler: pollingScheduler.getConfiguration()
      };
    } catch (error: any) {
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
  app.get("/settings/newsletter", async (request, reply) => {
    return {
      ...runtimeSettings.newsletter,
      availableLanguages: ['en', 'es', 'fr', 'de', 'pt', 'it'],
      availableCategories: ['world', 'technology', 'business', 'health', 'sports', 'entertainment'],
      templates: ['default', 'minimal', 'detailed']
    };
  });

  // Update newsletter settings
  app.put("/settings/newsletter", async (request, reply) => {
    try {
      const input = NewsletterSettingsSchema.partial().parse(request.body);
      
      // Update runtime settings
      runtimeSettings.newsletter = {
        ...runtimeSettings.newsletter,
        ...input
      };
      
      return {
        message: "Newsletter settings updated successfully",
        settings: runtimeSettings.newsletter
      };
    } catch (error: any) {
      return reply.code(400).type("application/problem+json").send({
        type: "about:blank",
        title: "Invalid newsletter settings",
        status: 400,
        detail: error.message,
        instance: request.url
      });
    }
  });

  // Get NewsAPI settings
  app.get("/settings/newsapi", async (request, reply) => {
    return {
      baseUrl: newsApiConfig.baseUrl,
      timeout: newsApiConfig.timeout,
      retries: newsApiConfig.retries,
      hasApiKey: !!newsApiConfig.apiKey,
      status: newsApiConfig.apiKey ? 'configured' : 'not_configured'
    };
  });

  // Test LLM connection
  app.post("/settings/llm/test", async (request, reply) => {
    try {
      // Import LLM service dynamically to test connection
      const { LLMService } = await import('../services/llm.js');
      const llmService = new LLMService();
      
      const testResult = await llmService.testConnection();
      
      return {
        success: true,
        provider: llmConfig.provider,
        model: llmConfig.model,
        result: testResult
      };
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error.message,
        provider: llmConfig.provider
      });
    }
  });

  // Reset settings to defaults
  app.post("/settings/reset", async (request, reply) => {
    const { section } = request.body as { section?: string };
    
    if (section === 'polling') {
      runtimeSettings.polling = {
        defaultInterval: 3600,
        batchSize: 10,
        maxRetries: 3,
        timeoutMs: 30000,
        maxConcurrentJobs: 3,
        checkIntervalMs: 30000
      };
    } else if (section === 'newsletter') {
      runtimeSettings.newsletter = {
        frequency: 'daily',
        maxArticles: 20,
        languages: ['en'],
        categories: ['world', 'technology'],
        emailTemplate: 'default'
      };
    } else {
      // Reset all runtime settings
      runtimeSettings = {
        polling: {
          defaultInterval: 3600,
          batchSize: 10,
          maxRetries: 3,
          timeoutMs: 30000,
          maxConcurrentJobs: 3,
          checkIntervalMs: 30000
        },
        newsletter: {
          frequency: 'daily',
          maxArticles: 20,
          languages: ['en'],
          categories: ['world', 'technology'],
          emailTemplate: 'default'
        }
      };
    }
    
    return {
      message: `Settings ${section ? `for ${section}` : ''} reset to defaults successfully`,
      settings: section ? runtimeSettings[section as keyof typeof runtimeSettings] : runtimeSettings
    };
  });

  // Get settings schema/documentation
  app.get("/settings/schema", async (request, reply) => {
    return {
      schemas: {
        system: SystemSettingsSchema.shape,
        llm: LLMSettingsSchema.shape,
        newsapi: NewsAPISettingsSchema.shape,
        polling: PollingSettingsSchema.shape,
        newsletter: NewsletterSettingsSchema.shape
      },
      descriptions: {
        system: "Core server configuration settings",
        llm: "Language model integration settings",
        newsapi: "News API service configuration",
        polling: "RSS feed polling and processing settings",
        newsletter: "Newsletter generation and delivery settings"
      }
    };
  });
}