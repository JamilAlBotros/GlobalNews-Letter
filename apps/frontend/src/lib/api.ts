import { z } from 'zod';

// Import schemas from the backend
export * from '../../../src/api/schemas/enhanced-schemas';

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

    const data = await response.json();
    return data;
  }

  // Feed Sources
  async getFeedSources() {
    return this.request('/api/enhanced/feeds/sources');
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
}

export const apiClient = new ApiClient(API_BASE_URL);