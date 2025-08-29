import { z } from 'zod';

// Frontend API schemas (simplified versions of backend schemas)
export const FeedSource = z.object({
  id: z.string(),
  name: z.string(),
  base_url: z.string(),
  provider_type: z.enum(['rss', 'google_rss', 'api', 'scraper']),
  source_language: z.enum(['en', 'es', 'ar', 'pt', 'fr', 'zh', 'ja']),
  primary_region: z.string().optional(),
  content_category: z.enum(['finance', 'tech', 'health', 'general']),
  content_type: z.enum(['breaking', 'analysis', 'daily', 'weekly']),
  is_active: z.boolean(),
  quality_score: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const FeedInstance = z.object({
  id: z.string(),
  source_id: z.string(),
  instance_name: z.string(),
  feed_url: z.string(),
  refresh_tier: z.enum(['realtime', 'frequent', 'standard', 'slow']),
  base_refresh_minutes: z.number(),
  is_active: z.boolean(),
  reliability_score: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ArticleOriginal = z.object({
  id: z.string(),
  feed_instance_id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  content: z.string().optional(),
  author: z.string().optional(),
  source_url: z.string(),
  published_at: z.string(),
  detected_language: z.string(),
  content_category: z.string().optional(),
  urgency_level: z.enum(['breaking', 'high', 'normal', 'low']).optional(),
  processing_stage: z.enum(['pending', 'processed', 'translated', 'published', 'failed']),
  is_selected: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type FeedSourceType = z.infer<typeof FeedSource>;
export type FeedInstanceType = z.infer<typeof FeedInstance>;
export type ArticleOriginalType = z.infer<typeof ArticleOriginal>;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3333';

// Ensure HTTPS in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production' && !API_BASE_URL.startsWith('https://')) {
  throw new Error('API_BASE_URL must use HTTPS in production');
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { 
      query?: Record<string, string | number | boolean>;
      idempotencyKey?: string;
    } = {}
  ): Promise<T> {
    const { query, idempotencyKey, ...fetchOptions } = options;
    
    let url = `${this.baseUrl}${endpoint}`;
    
    // Add query parameters
    if (query) {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      url += `?${params.toString()}`;
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    // Add idempotency key for POST requests
    if (idempotencyKey && fetchOptions.method === 'POST') {
      headers['Idempotency-Key'] = idempotencyKey;
    }

    const response = await fetch(url, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.title || `HTTP ${response.status}`);
      (error as any).status = response.status;
      (error as any).detail = errorData.detail;
      throw error;
    }

    const data = await response.json().catch(() => null);
    
    // Handle cases where server returns null or empty responses
    if (data === null || data === undefined) {
      console.warn(`API endpoint ${endpoint} returned null/undefined data`);
      return [] as T; // Return empty array for list endpoints
    }
    
    // Handle case where API returns plain array instead of paginated response
    if (Array.isArray(data) && endpoint.includes('/feeds/sources')) {
      return { data, pagination: { page: 1, limit: 100, total: data.length, totalPages: 1 } } as T;
    }
    
    return data;
  }

  // Feed Sources
  async getFeedSources() {
    try {
      const response = await this.request<{
        data: FeedSourceType[];
        pagination: { page: number; limit: number; total: number; totalPages: number };
      }>('/api/enhanced/feeds/sources', {
        query: { page: '1', limit: '100' }
      });
      return response?.data || [];
    } catch (error) {
      console.error('Failed to fetch feed sources:', error);
      return [];
    }
  }

  async createFeedSource(data: any, idempotencyKey?: string) {
    return this.request('/api/enhanced/feeds/sources', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey,
    });
  }

  async updateFeedSource(id: string, data: any) {
    return this.request(`/api/enhanced/feeds/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFeedSource(id: string) {
    return this.request(`/api/enhanced/feeds/sources/${id}`, {
      method: 'DELETE',
    });
  }

  // Feed Instances
  async getFeedInstances(sourceId?: string) {
    return this.request('/api/enhanced/feeds/instances', {
      query: sourceId ? { source_id: sourceId } : {},
    });
  }

  async createFeedInstance(data: any, idempotencyKey?: string) {
    return this.request('/api/enhanced/feeds/instances', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey,
    });
  }

  async updateFeedInstance(id: string, data: any) {
    return this.request(`/api/enhanced/feeds/instances/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFeedInstance(id: string) {
    return this.request(`/api/enhanced/feeds/instances/${id}`, {
      method: 'DELETE',
    });
  }

  // Articles
  async getArticles(filters: {
    language?: string;
    category?: string;
    processing_stage?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    return this.request('/api/enhanced/articles', { query: filters });
  }

  async getArticle(id: string) {
    return this.request(`/api/enhanced/articles/${id}`);
  }

  async updateArticle(id: string, data: any) {
    return this.request(`/api/enhanced/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Translations
  async getTranslations(articleId?: string) {
    return this.request('/api/enhanced/translations', {
      query: articleId ? { article_id: articleId } : {},
    });
  }

  async createTranslationJob(data: any, idempotencyKey?: string) {
    return this.request('/api/enhanced/translations/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey,
    });
  }

  async getTranslationJobs() {
    return this.request('/api/enhanced/translations/jobs');
  }

  // Health & Analytics
  async getSystemHealth() {
    return this.request('/api/enhanced/health');
  }

  async getHealthAnalytics() {
    return this.request('/api/enhanced/health/analytics');
  }

  async getFeedMetrics() {
    return this.request('/api/enhanced/analytics/feeds');
  }

  async getTranslationMetrics() {
    return this.request('/api/enhanced/analytics/translations');
  }

  // Database Management
  async createBackup(options: { compress?: boolean } = {}) {
    return this.request('/api/enhanced/database/backup', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async getBackups() {
    return this.request('/api/enhanced/database/backups');
  }

  async restoreBackup(filename: string) {
    return this.request('/api/enhanced/database/restore', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
  }

  async wipeDatabase() {
    return this.request('/api/enhanced/database/wipe', {
      method: 'POST',
    });
  }

  // Polling Management
  async getPollingStatus() {
    return this.request('/api/enhanced/polling/status');
  }

  async startPolling() {
    return this.request('/api/enhanced/polling/start', {
      method: 'POST',
    });
  }

  async stopPolling() {
    return this.request('/api/enhanced/polling/stop', {
      method: 'POST',
    });
  }

  async triggerPoll() {
    return this.request('/api/enhanced/polling/trigger', {
      method: 'POST',
    });
  }

  async updatePollingInterval(data: { minutes: number }) {
    return this.request('/api/enhanced/polling/interval', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getActiveFeedsStatus() {
    return this.request('/api/enhanced/polling/feeds');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);