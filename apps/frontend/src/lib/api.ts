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
  detected_language: z.string().nullable(),
  needs_manual_language_review: z.boolean(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  url: z.string(),
  published_at: z.string(),
  scraped_at: z.string(),
  created_at: z.string(),
});

export const Backup = z.object({
  filename: z.string(),
  size: z.number(),
  created_at: z.string(),
  compressed: z.boolean()
});

export const BackupResponse = z.object({
  filename: z.string(),
  size: z.number(),
  created_at: z.string()
});

export const DatabaseWipeResponse = z.object({
  success: z.boolean(),
  tables_cleared: z.array(z.string()),
  timestamp: z.string()
});

export const PollingStatus = z.object({
  is_running: z.boolean(),
  interval_minutes: z.number(),
  last_poll_time: z.string().nullable(),
  next_poll_time: z.string().nullable(),
  total_polls: z.number(),
  successful_polls: z.number(),
  failed_polls: z.number(),
  active_feeds_count: z.number()
});

export const PollTriggerResponse = z.object({
  success: z.boolean(),
  message: z.string(),
  feeds_processed: z.number(),
  articles_found: z.number(),
  timestamp: z.string()
});

export const ActiveFeedStatus = z.object({
  feed_id: z.string(),
  feed_name: z.string(),
  feed_url: z.string(),
  status: z.enum(["healthy", "warning", "critical", "unknown"]),
  last_fetch_time: z.string().nullable(),
  next_fetch_time: z.string().nullable(),
  success_rate: z.number(),
  consecutive_failures: z.number(),
  total_fetches_24h: z.number(),
  successful_fetches_24h: z.number(),
  avg_response_time: z.number(),
  articles_fetched_24h: z.number()
});

export const ActiveFeedsStatusResponse = z.object({
  polling_active: z.boolean(),
  feeds: z.array(ActiveFeedStatus),
  summary: z.object({
    total_active_feeds: z.number(),
    healthy_feeds: z.number(),
    warning_feeds: z.number(),
    critical_feeds: z.number(),
    avg_success_rate: z.number()
  })
});

export const TranslationJob = z.object({
  id: z.string(),
  article_id: z.string(),
  article_title: z.string(),
  source_language: z.enum(["en", "es", "ar", "pt", "fr", "zh", "ja"]),
  target_languages: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  progress_percentage: z.number(),
  assigned_worker: z.string().nullable(),
  retry_count: z.number(),
  max_retries: z.number(),
  estimated_completion: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  error_message: z.string().nullable(),
  word_count: z.number(),
  cost_estimate: z.number().nullable()
});

export const TranslationJobsResponse = z.object({
  data: z.array(TranslationJob),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    total_pages: z.number()
  })
});

export const PollingJob = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  is_active: z.boolean(),
  interval_minutes: z.number(),
  feed_filters: z.object({
    feed_ids: z.array(z.string()).optional(),
    categories: z.array(z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"])).optional(),
    languages: z.array(z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"])).optional(),
    regions: z.array(z.string()).optional(),
    types: z.array(z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"])).optional()
  }),
  last_run_time: z.string().nullable(),
  next_run_time: z.string().nullable(),
  total_runs: z.number(),
  successful_runs: z.number(),
  failed_runs: z.number(),
  last_run_stats: z.object({
    feeds_processed: z.number(),
    articles_found: z.number(),
    execution_time_ms: z.number()
  }).nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

export const PollingJobsResponse = z.object({
  data: z.array(PollingJob),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    total_pages: z.number()
  })
});

export const FeedFilterOptions = z.object({
  categories: z.array(z.string()),
  languages: z.array(z.string()),
  regions: z.array(z.string()),
  types: z.array(z.string()),
  total_feeds: z.number()
});

export const FilteredFeedsResponse = z.object({
  feeds: z.array(Feed),
  total: z.number(),
  applied_filters: z.object({
    categories: z.array(z.string()).optional(),
    languages: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    types: z.array(z.string()).optional(),
    feed_ids: z.array(z.string()).optional()
  })
});

export type FeedType = z.infer<typeof Feed>;
export type ArticleType = z.infer<typeof Article>;
export type BackupType = z.infer<typeof Backup>;
export type BackupResponseType = z.infer<typeof BackupResponse>;
export type DatabaseWipeResponseType = z.infer<typeof DatabaseWipeResponse>;
export type PollingStatusType = z.infer<typeof PollingStatus>;
export type PollTriggerResponseType = z.infer<typeof PollTriggerResponse>;
export type ActiveFeedStatusType = z.infer<typeof ActiveFeedStatus>;
export type ActiveFeedsStatusResponseType = z.infer<typeof ActiveFeedsStatusResponse>;
export type TranslationJobType = z.infer<typeof TranslationJob>;
export type TranslationJobsResponseType = z.infer<typeof TranslationJobsResponse>;
export type PollingJobType = z.infer<typeof PollingJob>;
export type PollingJobsResponseType = z.infer<typeof PollingJobsResponse>;
export type FeedFilterOptionsType = z.infer<typeof FeedFilterOptions>;
export type FilteredFeedsResponseType = z.infer<typeof FilteredFeedsResponse>;

const API_BASE_URL = process.env.BASE_API || 'http://localhost:3333';

// Ensure HTTPS in production (but allow localhost in development)
if (typeof window === 'undefined' && 
    process.env.NODE_ENV === 'production' && 
    !API_BASE_URL.startsWith('https://') && 
    !API_BASE_URL.startsWith('http://localhost') &&
    !API_BASE_URL.startsWith('http://api:')) {
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

    const headers: Record<string, string> = {
      ...(fetchOptions.headers as Record<string, string> || {}),
    };
    
    // Only set Content-Type if there's a body
    if (fetchOptions.body) {
      headers['Content-Type'] = 'application/json';
    }

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

  async validateRSSFeed(url: string) {
    return this.request<{
      url: string;
      validation_result: {
        isValid: boolean;
        message: string;
        hasEntries?: boolean;
        feedTitle?: string;
        entryCount?: number;
      };
      timestamp: string;
    }>('/feeds/validate', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  async batchCreateFeeds(feeds: Array<{
    name: string;
    url: string;
    language: string;
    region: string;
    category: string;
    type: string;
    description?: string;
  }>) {
    return this.request<{
      message: string;
      summary: {
        total_processed: number;
        successful: number;
        failed: number;
      };
      errors: Array<{
        index: number;
        url: string;
        error: string;
      }>;
    }>('/feeds/batch', {
      method: 'POST',
      body: JSON.stringify(feeds),
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

  // Backup Management endpoints
  async getBackups(): Promise<BackupType[]> {
    return this.request<BackupType[]>('/admin/backups');
  }

  async createBackup(options: { compress?: boolean } = {}): Promise<BackupResponseType> {
    return this.request<BackupResponseType>('/admin/backups', {
      method: 'POST',
      body: JSON.stringify({ compress: options.compress ?? true }),
    });
  }

  async restoreBackup(filename: string): Promise<{ success: boolean; message: string; timestamp: string }> {
    return this.request('/admin/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ filename }),
    });
  }

  async wipeDatabase(): Promise<DatabaseWipeResponseType> {
    return this.request<DatabaseWipeResponseType>('/admin/database', {
      method: 'DELETE',
    });
  }

  // Polling Management endpoints
  async getPollingStatus(): Promise<PollingStatusType> {
    return this.request<PollingStatusType>('/polling/status');
  }

  async startPolling(options: { interval_minutes?: number } = {}): Promise<{ success: boolean; message: string; interval_minutes: number }> {
    return this.request('/polling/start', {
      method: 'POST',
      body: JSON.stringify(options),
    });
  }

  async stopPolling(): Promise<{ success: boolean; message: string }> {
    return this.request('/polling/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
  }

  async triggerPoll(): Promise<PollTriggerResponseType> {
    return this.request<PollTriggerResponseType>('/polling/trigger', {
      method: 'POST',
    });
  }

  async updatePollingInterval(interval_minutes: number): Promise<{ success: boolean; message: string; interval_minutes: number; polling_restarted: boolean }> {
    return this.request('/polling/interval', {
      method: 'PUT',
      body: JSON.stringify({ interval_minutes }),
    });
  }

  async getActiveFeedsStatus(): Promise<ActiveFeedsStatusResponseType> {
    return this.request<ActiveFeedsStatusResponseType>('/polling/feeds/status');
  }

  // Translation Management endpoints
  async getTranslationJobs(page: number = 1, limit: number = 20, filters: { status?: string; priority?: string; article_id?: string } = {}): Promise<TranslationJobType[]> {
    try {
      const query: any = { page, limit };
      if (filters.status) query.status = filters.status;
      if (filters.priority) query.priority = filters.priority;
      if (filters.article_id) query.article_id = filters.article_id;
      
      const response = await this.request<TranslationJobsResponseType>('/translations/jobs', { query });
      return response?.data || [];
    } catch (error) {
      console.error('Failed to fetch translation jobs:', error);
      return [];
    }
  }

  async getTranslationJob(id: string): Promise<TranslationJobType> {
    return this.request<TranslationJobType>(`/translations/jobs/${id}`);
  }

  async createTranslationJob(data: { article_id: string; target_languages: string[]; priority?: string }): Promise<TranslationJobType> {
    return this.request<TranslationJobType>('/translations/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTranslationJob(id: string, data: { status?: string; priority?: string; progress_percentage?: number; assigned_worker?: string | null; error_message?: string | null }): Promise<TranslationJobType> {
    return this.request<TranslationJobType>(`/translations/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTranslationJob(id: string): Promise<void> {
    return this.request(`/translations/jobs/${id}`, {
      method: 'DELETE',
    });
  }

  async batchUpdateTranslationJobs(job_ids: string[], updates: { status?: string; assigned_worker?: string | null }): Promise<{ success: boolean; updated_count: number; message: string }> {
    return this.request('/translations/jobs/batch', {
      method: 'PATCH',
      body: JSON.stringify({ job_ids, ...updates }),
    });
  }

  // Feed Filter Management endpoints
  async getFeedFilterOptions(): Promise<FeedFilterOptionsType> {
    return this.request<FeedFilterOptionsType>('/feeds/filter-options');
  }

  async getFilteredFeeds(filters: {
    categories?: string[];
    languages?: string[];
    regions?: string[];
    types?: string[];
    feed_ids?: string[];
  }): Promise<FilteredFeedsResponseType> {
    return this.request<FilteredFeedsResponseType>('/feeds/filtered', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  }

  // Polling Jobs Management endpoints
  async getPollingJobs(page: number = 1, limit: number = 20): Promise<PollingJobType[]> {
    try {
      const response = await this.request<PollingJobsResponseType>('/polling/jobs', {
        query: { page, limit }
      });
      return response?.data || [];
    } catch (error) {
      console.error('Failed to fetch polling jobs:', error);
      return [];
    }
  }

  async getPollingJob(id: string): Promise<PollingJobType> {
    return this.request<PollingJobType>(`/polling/jobs/${id}`);
  }

  async createPollingJob(data: {
    name: string;
    description?: string;
    interval_minutes: number;
    feed_filters: {
      feed_ids?: string[];
      categories?: string[];
      languages?: string[];
      regions?: string[];
      types?: string[];
    };
  }): Promise<PollingJobType> {
    return this.request<PollingJobType>('/polling/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePollingJob(id: string, data: {
    name?: string;
    description?: string;
    is_active?: boolean;
    interval_minutes?: number;
    feed_filters?: {
      feed_ids?: string[];
      categories?: string[];
      languages?: string[];
      regions?: string[];
      types?: string[];
    };
  }): Promise<PollingJobType> {
    return this.request<PollingJobType>(`/polling/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePollingJob(id: string): Promise<void> {
    return this.request(`/polling/jobs/${id}`, {
      method: 'DELETE',
    });
  }

  async executePollingJob(id: string): Promise<{
    success: boolean;
    message: string;
    job_id: string;
    feeds_processed: number;
    articles_found: number;
    execution_time_ms: number;
    timestamp: string;
  }> {
    return this.request(`/polling/jobs/${id}/execute`, {
      method: 'POST',
    });
  }

  async manualPollWithFilters(filters?: {
    feed_ids?: string[];
    categories?: string[];
    languages?: string[];
    regions?: string[];
    types?: string[];
  }): Promise<{
    success: boolean;
    message: string;
    feeds_processed: number;
    articles_found: number;
    execution_time_ms: number;
    timestamp: string;
  }> {
    return this.request('/polling/manual', {
      method: 'POST',
      body: JSON.stringify({ feed_filters: filters }),
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);