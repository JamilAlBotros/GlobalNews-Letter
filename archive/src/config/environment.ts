import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

/**
 * Environment Configuration Schema
 * Validates and provides type-safe access to environment variables
 * Following CLAUDE.md security guidelines
 */

const EnvironmentSchema = z.object({
  // Environment
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  API_PORT: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1).max(65535)).default(3333),
  API_HOST: z.string().default('127.0.0.1'),
  DEBUG: z.string().transform(val => val === 'true').default(false),

  // Database
  DATABASE_PATH: z.string().default('./data/enhanced-rss.db'),
  DATABASE_BACKUP_PATH: z.string().default('./data/backups'),
  DATABASE_WAL_MODE: z.string().transform(val => val === 'true').default(true),
  DATABASE_MAX_CONNECTIONS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(10),

  // Security & Auth
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_ISSUER: z.string().default('globalnews-letter'),
  JWT_AUDIENCE: z.string().default('globalnews-app'),
  JWT_EXPIRY: z.string().default('1h'),
  API_KEY: z.string().optional(),

  // CORS & Rate Limiting
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_RPS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(10),
  RATE_LIMIT_WINDOW_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1000)).default(60000),

  // Translation Services
  LLM_PROVIDER: z.enum(['openai', 'anthropic', 'mock']).default('mock'),
  LLM_API_KEY: z.string().optional(),
  LLM_MODEL: z.string().default('gpt-4'),
  LLM_BASE_URL: z.string().url().optional(),
  LLM_MAX_TOKENS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(100)).default(4000),
  LLM_TEMPERATURE: z.string().transform(val => parseFloat(val)).pipe(z.number().min(0).max(2)).default(0.3),

  // Translation Pipeline
  MAX_CONCURRENT_TRANSLATIONS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(3),
  TRANSLATION_QUEUE_MAX_SIZE: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(10)).default(1000),
  TRANSLATION_RETRY_ATTEMPTS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0)).default(3),
  TRANSLATION_TIMEOUT_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(5000)).default(30000),

  // RSS Feed Processing
  RSS_USER_AGENT: z.string().default('GlobalNews Letter/1.0'),
  RSS_TIMEOUT_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1000)).default(15000),
  RSS_MAX_CONCURRENT_FEEDS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(5),
  RSS_RETRY_ATTEMPTS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0)).default(3),
  RSS_RETRY_DELAY_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(100)).default(1000),

  // Refresh Intervals
  REALTIME_REFRESH_MINUTES: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(5),
  FREQUENT_REFRESH_MINUTES: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(5)).default(30),
  STANDARD_REFRESH_MINUTES: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(30)).default(120),
  SLOW_REFRESH_MINUTES: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(60)).default(480),

  // Health Monitoring
  HEALTH_CHECK_INTERVAL_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(30000)).default(300000),
  HEALTH_METRICS_RETENTION_DAYS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(30),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  ALERT_EMAIL_RECIPIENT: z.string().email().optional(),

  // Performance Thresholds
  MAX_RESPONSE_TIME_MS: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1000)).default(5000),
  MIN_FEED_RELIABILITY: z.string().transform(val => parseFloat(val)).pipe(z.number().min(0).max(1)).default(0.7),
  MIN_TRANSLATION_QUALITY: z.string().transform(val => parseFloat(val)).pipe(z.number().min(0).max(1)).default(0.75),
  MAX_QUEUE_BACKLOG: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(10)).default(200),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_FORMAT: z.enum(['json', 'text']).default('json'),
  LOG_FILE_PATH: z.string().optional(),
  LOG_MAX_FILES: z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(1)).default(5),
  LOG_MAX_SIZE: z.string().default('10MB'),

  // Feature Flags
  ENABLE_TRANSLATIONS: z.string().transform(val => val !== 'false').default(true),
  ENABLE_ANALYTICS: z.string().transform(val => val !== 'false').default(true),
  ENABLE_HEALTH_MONITORING: z.string().transform(val => val !== 'false').default(true),
  ENABLE_AUTO_RETRY: z.string().transform(val => val !== 'false').default(true),
  ENABLE_ADAPTIVE_REFRESH: z.string().transform(val => val !== 'false').default(true),

  // Development
  DEV_MOCK_LLM: z.string().transform(val => val === 'true').default(false),
  DEV_MOCK_RSS: z.string().transform(val => val === 'true').default(false),
  DEV_SEED_DATA: z.string().transform(val => val === 'true').default(false),
  DEV_SKIP_AUTH: z.string().transform(val => val === 'true').default(false),
});

export type Environment = z.infer<typeof EnvironmentSchema>;

/**
 * Validates and exports environment configuration
 * Throws descriptive error if validation fails
 */
function validateEnvironment(): Environment {
  try {
    return EnvironmentSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `${issue.path.join('.')}: ${issue.message}`
      );
      
      console.error('❌ Environment validation failed:');
      issues.forEach(issue => console.error(`  - ${issue}`));
      console.error('\nPlease check your .env file against .env.example');
      
      process.exit(1);
    }
    throw error;
  }
}

export const env = validateEnvironment();

/**
 * Helper functions for environment-specific behavior
 */
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isStaging = env.NODE_ENV === 'staging';

/**
 * Database configuration object
 */
export const databaseConfig = {
  path: env.DATABASE_PATH,
  backupPath: env.DATABASE_BACKUP_PATH,
  walMode: env.DATABASE_WAL_MODE,
  maxConnections: env.DATABASE_MAX_CONNECTIONS,
} as const;

/**
 * Security configuration object
 */
export const securityConfig = {
  jwt: {
    secret: env.JWT_SECRET,
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: env.JWT_EXPIRY,
  },
  apiKey: env.API_KEY,
  cors: {
    origins: env.CORS_ORIGINS.split(',').map(origin => origin.trim()),
  },
  rateLimit: {
    rps: env.RATE_LIMIT_RPS,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
  },
} as const;

/**
 * LLM service configuration
 */
export const llmConfig = {
  provider: env.LLM_PROVIDER,
  apiKey: env.LLM_API_KEY,
  model: env.LLM_MODEL,
  baseUrl: env.LLM_BASE_URL,
  maxTokens: env.LLM_MAX_TOKENS,
  temperature: env.LLM_TEMPERATURE,
  mockInDev: env.DEV_MOCK_LLM || (isDevelopment && !env.LLM_API_KEY),
} as const;

/**
 * RSS processing configuration
 */
export const rssConfig = {
  userAgent: env.RSS_USER_AGENT,
  timeoutMs: env.RSS_TIMEOUT_MS,
  maxConcurrent: env.RSS_MAX_CONCURRENT_FEEDS,
  retryAttempts: env.RSS_RETRY_ATTEMPTS,
  retryDelayMs: env.RSS_RETRY_DELAY_MS,
  mockInDev: env.DEV_MOCK_RSS,
  
  refreshIntervals: {
    realtime: env.REALTIME_REFRESH_MINUTES * 60 * 1000,
    frequent: env.FREQUENT_REFRESH_MINUTES * 60 * 1000,
    standard: env.STANDARD_REFRESH_MINUTES * 60 * 1000,
    slow: env.SLOW_REFRESH_MINUTES * 60 * 1000,
  },
} as const;

/**
 * Health monitoring configuration
 */
export const healthConfig = {
  checkIntervalMs: env.HEALTH_CHECK_INTERVAL_MS,
  metricsRetentionDays: env.HEALTH_METRICS_RETENTION_DAYS,
  alertWebhookUrl: env.ALERT_WEBHOOK_URL,
  alertEmailRecipient: env.ALERT_EMAIL_RECIPIENT,
  
  thresholds: {
    maxResponseTimeMs: env.MAX_RESPONSE_TIME_MS,
    minFeedReliability: env.MIN_FEED_RELIABILITY,
    minTranslationQuality: env.MIN_TRANSLATION_QUALITY,
    maxQueueBacklog: env.MAX_QUEUE_BACKLOG,
  },
} as const;

/**
 * Translation pipeline configuration
 */
export const translationConfig = {
  maxConcurrent: env.MAX_CONCURRENT_TRANSLATIONS,
  queueMaxSize: env.TRANSLATION_QUEUE_MAX_SIZE,
  retryAttempts: env.TRANSLATION_RETRY_ATTEMPTS,
  timeoutMs: env.TRANSLATION_TIMEOUT_MS,
} as const;

/**
 * Feature flags
 */
export const features = {
  translations: env.ENABLE_TRANSLATIONS,
  analytics: env.ENABLE_ANALYTICS,
  healthMonitoring: env.ENABLE_HEALTH_MONITORING,
  autoRetry: env.ENABLE_AUTO_RETRY,
  adaptiveRefresh: env.ENABLE_ADAPTIVE_REFRESH,
} as const;