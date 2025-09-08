import { z } from 'zod';

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  DATABASE_URL: z.string().default('./data/newsletter.db'),
  
  // LLM Configuration
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'ollama', 'mock']).default('ollama'),
  LLM_API_KEY: z.string().optional(),
  LLM_BASE_URL: z.string().default('http://127.0.0.1:11434'),
  LLM_MODEL: z.string().default('mistral'),
  LLM_MAX_TOKENS: z.string().transform(Number).default('1000'),
  LLM_TEMPERATURE: z.string().transform(Number).default('0.3'),
  
  // NewsAPI Configuration
  NEWSAPI_KEY: z.string().optional(),
  NEWSAPI_BASE_URL: z.string().default('https://newsapi.org/v2'),
});

const env = EnvironmentSchema.parse(process.env);

export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

export const serverConfig = {
  port: env.PORT,
  host: isDevelopment ? '127.0.0.1' : '0.0.0.0',
  logger: isDevelopment,
};

export const databaseConfig = {
  url: env.DATABASE_URL,
  logging: isDevelopment,
};

export const llmConfig = {
  provider: env.LLM_PROVIDER,
  apiKey: env.LLM_API_KEY,
  baseUrl: env.LLM_BASE_URL,
  model: env.LLM_MODEL,
  maxTokens: env.LLM_MAX_TOKENS,
  temperature: env.LLM_TEMPERATURE,
};

export const newsApiConfig = {
  apiKey: env.NEWSAPI_KEY,
  baseUrl: env.NEWSAPI_BASE_URL,
  timeout: 30000,
  retries: 3,
};