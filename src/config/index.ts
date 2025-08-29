import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config({ path: '.local.env' });

const ConfigSchema = z.object({
  NEWSAPI_API_KEY: z.string().min(1, 'NewsAPI key is required'),
  NEWSAPI_BASE_URL: z.string().url().default('https://newsapi.org/v2'),
  LLM_API_URL: z.string().url().default('http://localhost:11434'),
  LLM_MODEL: z.string().default('codellama:7b'),
  DATABASE_PATH: z.string().default('./data/articles.db'),
  OUTPUT_DIR: z.string().default('./output'),
});

const parseConfig = () => {
  try {
    return ConfigSchema.parse({
      NEWSAPI_API_KEY: process.env.NEWSAPI_API_KEY,
      NEWSAPI_BASE_URL: process.env.NEWSAPI_BASE_URL,
      LLM_API_URL: process.env.LLM_API_URL,
      LLM_MODEL: process.env.LLM_MODEL,
      DATABASE_PATH: process.env.DATABASE_PATH,
      OUTPUT_DIR: process.env.OUTPUT_DIR,
    });
  } catch (error) {
    console.error('Configuration validation failed:', error);
    process.exit(1);
  }
};

export const appConfig = parseConfig();

// Category to NewsAPI query mappings
export const CATEGORY_QUERIES = {
  finance: [
    'finance',
    'banking',
    'cryptocurrency',
    'stock market',
    'investment',
    'economy',
    'trading',
    'fintech'
  ],
  tech: [
    'technology',
    'artificial intelligence',
    'AI',
    'software',
    'programming',
    'startup',
    'silicon valley',
    'tech company'
  ]
} as const;

// Language mappings for NewsAPI
export const NEWS_API_LANGUAGES = {
  english: 'en',
  spanish: 'es',
  arabic: 'ar',
  portuguese: 'pt',
  french: 'fr',
  chinese: 'zh', 
  japanese: 'en' // NewsAPI doesn't have Japanese, fallback to English
} as const;

// Popular tech and finance sources
export const PREFERRED_SOURCES = {
  finance: [
    'bloomberg',
    'financial-times',
    'reuters',
    'cnbc',
    'wall-street-journal',
    'fortune'
  ],
  tech: [
    'techcrunch',
    'ars-technica',
    'the-verge',
    'wired',
    'hacker-news',
    'engadget'
  ]
} as const;