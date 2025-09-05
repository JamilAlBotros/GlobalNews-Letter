// Test data for settings endpoints

export const mockSystemSettings = {
  port: 3333,
  host: "0.0.0.0",
  logger: false,
  environment: "test",
  uptime: 12345,
  memory: {
    rss: 50331648,
    heapTotal: 33554432,
    heapUsed: 15728640,
    external: 2097152,
    arrayBuffers: 1048576
  },
  version: "v20.0.0"
};

export const mockLLMSettings = {
  provider: "ollama",
  baseUrl: "http://127.0.0.1:11434",
  model: "mistral",
  maxTokens: 1000,
  temperature: 0.3,
  mockInDev: true,
  hasApiKey: false,
  supportedProviders: ["openai", "anthropic", "ollama", "mock"]
};

export const mockPollingSettings = {
  defaultInterval: 3600,
  batchSize: 10,
  maxRetries: 3,
  timeoutMs: 30000,
  status: "active",
  lastRun: "2025-01-15T10:30:00.000Z",
  nextRun: "2025-01-15T11:30:00.000Z"
};

export const mockNewsletterSettings = {
  frequency: "daily" as const,
  maxArticles: 20,
  languages: ["en", "es"],
  categories: ["world", "technology", "business"],
  emailTemplate: "default",
  availableLanguages: ["en", "es", "fr", "de", "pt", "it"],
  availableCategories: ["world", "technology", "business", "health", "sports", "entertainment"],
  templates: ["default", "minimal", "detailed"]
};

export const mockNewsAPISettings = {
  baseUrl: "https://newsapi.org/v2",
  timeout: 30000,
  retries: 3,
  hasApiKey: false,
  status: "not_configured"
};

export const mockDatabaseSettings = {
  url: "./data/test.db",
  logging: true
};

export const mockAllSettings = {
  system: mockSystemSettings,
  database: mockDatabaseSettings,
  llm: mockLLMSettings,
  newsapi: mockNewsAPISettings,
  polling: mockPollingSettings,
  newsletter: mockNewsletterSettings
};

// Valid update payloads for testing
export const validLLMUpdate = {
  provider: "openai" as const,
  model: "gpt-4",
  maxTokens: 2000,
  temperature: 0.5
};

export const validPollingUpdate = {
  defaultInterval: 7200, // 2 hours
  batchSize: 15,
  maxRetries: 5,
  timeoutMs: 45000
};

export const validNewsletterUpdate = {
  frequency: "weekly" as const,
  maxArticles: 30,
  languages: ["en", "fr", "de"],
  categories: ["world", "technology", "health"],
  emailTemplate: "detailed"
};

// Invalid payloads for testing validation
export const invalidLLMUpdate = {
  provider: "invalid-provider",
  maxTokens: -1,
  temperature: 5.0 // Too high
};

export const invalidPollingUpdate = {
  defaultInterval: 30, // Too low (minimum 60)
  batchSize: 150, // Too high (maximum 100)
  maxRetries: -1,
  timeoutMs: 1000 // Too low (minimum 5000)
};

export const invalidNewsletterUpdate = {
  frequency: "invalid-frequency",
  maxArticles: 0, // Too low
  languages: [], // Empty array
  categories: []
};

// Expected responses for successful operations
export const expectedUpdateResponses = {
  llm: {
    message: "LLM settings validation successful. Note: Changes require server restart to take effect.",
    validated: validLLMUpdate,
    current: mockLLMSettings
  },
  polling: {
    message: "Polling settings updated successfully",
    settings: {
      ...mockPollingSettings,
      ...validPollingUpdate
    }
  },
  newsletter: {
    message: "Newsletter settings updated successfully",
    settings: {
      ...mockNewsletterSettings,
      ...validNewsletterUpdate
    }
  }
};

// Schema descriptions for validation
export const expectedSchemaResponse = {
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
};

// Test connection responses
export const mockLLMTestResponse = {
  success: true,
  provider: "ollama",
  model: "mistral",
  result: "Connection successful"
};

export const mockLLMTestFailure = {
  success: false,
  error: "Connection failed: Unable to reach LLM service",
  provider: "ollama"
};