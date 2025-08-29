import { z } from 'zod';

// Frontend API schemas (matching new simplified backend)
export const Feed = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  language: z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"]),
  region: z.string(),
  category: z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"]),
  type: z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"]),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const Article = z.object({
  id: z.string(),
  feed_id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  url: z.string(),
  published_at: z.string(),
  scraped_at: z.string(),
  created_at: z.string(),
});

export type FeedType = z.infer<typeof Feed>;
export type ArticleType = z.infer<typeof Article>;

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

  // Feeds
  async getFeeds(page: number = 1, limit: number = 20) {
    try {
      const response = await this.request<{
        data: FeedType[];
        pagination: { page: number; limit: number; total: number; total_pages: number };
      }>('/feeds', {
        query: { page, limit }
      });
      return response?.data || [];
    } catch (error) {
      console.error('Failed to fetch feeds:', error);
      return [];
    }
  }

  async getFeed(id: string) {
    return this.request<FeedType>(`/feeds/${id}`);
  }

  async createFeed(data: Omit<FeedType, 'id' | 'created_at' | 'updated_at'>, idempotencyKey?: string) {
    return this.request<FeedType>('/feeds', {
      method: 'POST',
      body: JSON.stringify(data),
      idempotencyKey,
    });
  }

  async updateFeed(id: string, data: Partial<Omit<FeedType, 'id' | 'created_at' | 'updated_at'>>) {
    return this.request<FeedType>(`/feeds/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFeed(id: string) {
    return this.request(`/feeds/${id}`, {
      method: 'DELETE',
    });
  }

  // Articles
  async getArticles(page: number = 1, limit: number = 20, feedId?: string) {
    try {
      const query: any = { page, limit };
      if (feedId) query.feed_id = feedId;
      
      const response = await this.request<{
        data: ArticleType[];
        pagination: { page: number; limit: number; total: number; total_pages: number };
      }>('/articles', { query });
      return response?.data || [];
    } catch (error) {
      console.error('Failed to fetch articles:', error);
      return [];
    }
  }

  async getArticle(id: string) {
    return this.request<ArticleType>(`/articles/${id}`);
  }

  async createArticle(data: Omit<ArticleType, 'id' | 'scraped_at' | 'created_at'>) {
    return this.request<ArticleType>('/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateArticle(id: string, data: Partial<Omit<ArticleType, 'id' | 'feed_id' | 'scraped_at' | 'created_at'>>) {
    return this.request<ArticleType>(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteArticle(id: string) {
    return this.request(`/articles/${id}`, {
      method: 'DELETE',
    });
  }

  // Health endpoints
  async getHealth() {
    return this.request('/healthz');
  }

  async getReadiness() {
    return this.request('/readyz');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);