import { z } from "zod";

export const PollingStatus = z.object({
  is_running: z.boolean(),
  interval_minutes: z.number().int().min(1),
  last_poll_time: z.string().datetime().nullable(),
  next_poll_time: z.string().datetime().nullable(),
  total_polls: z.number().int().min(0),
  successful_polls: z.number().int().min(0),
  failed_polls: z.number().int().min(0),
  active_feeds_count: z.number().int().min(0)
});

export const StartPollingInput = z.object({
  interval_minutes: z.number().int().min(1).max(1440).optional()
});

export const UpdatePollingIntervalInput = z.object({
  interval_minutes: z.number().int().min(1).max(1440)
});

export const PollTriggerResponse = z.object({
  success: z.boolean(),
  message: z.string(),
  feeds_processed: z.number().int().min(0),
  articles_found: z.number().int().min(0),
  timestamp: z.string().datetime()
});

export const ActiveFeedStatus = z.object({
  feed_id: z.string(),
  feed_name: z.string(),
  feed_url: z.string().url(),
  status: z.enum(["healthy", "warning", "critical", "unknown"]),
  last_fetch_time: z.string().datetime().nullable(),
  next_fetch_time: z.string().datetime().nullable(),
  success_rate: z.number().min(0).max(1),
  consecutive_failures: z.number().int().min(0),
  total_fetches_24h: z.number().int().min(0),
  successful_fetches_24h: z.number().int().min(0),
  avg_response_time: z.number().min(0),
  articles_fetched_24h: z.number().int().min(0)
});

export const ActiveFeedsStatusResponse = z.object({
  polling_active: z.boolean(),
  feeds: z.array(ActiveFeedStatus),
  summary: z.object({
    total_active_feeds: z.number().int().min(0),
    healthy_feeds: z.number().int().min(0),
    warning_feeds: z.number().int().min(0),
    critical_feeds: z.number().int().min(0),
    avg_success_rate: z.number().min(0).max(1)
  })
});

// Polling Jobs Schema
export const PollingJob = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  is_active: z.boolean(),
  interval_minutes: z.number().int().min(1).max(1440),
  feed_filters: z.object({
    feed_ids: z.array(z.string()).optional(),
    categories: z.array(z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"])).optional(),
    languages: z.array(z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"])).optional(),
    regions: z.array(z.string()).optional(),
    types: z.array(z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"])).optional()
  }),
  last_run_time: z.string().datetime().nullable(),
  next_run_time: z.string().datetime().nullable(),
  total_runs: z.number().int().min(0),
  successful_runs: z.number().int().min(0),
  failed_runs: z.number().int().min(0),
  last_run_stats: z.object({
    feeds_processed: z.number().int().min(0),
    articles_found: z.number().int().min(0),
    execution_time_ms: z.number().min(0)
  }).nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreatePollingJobInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  interval_minutes: z.number().int().min(1).max(1440),
  feed_filters: z.object({
    feed_ids: z.array(z.string()).optional(),
    categories: z.array(z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"])).optional(),
    languages: z.array(z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"])).optional(),
    regions: z.array(z.string()).optional(),
    types: z.array(z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"])).optional()
  })
});

export const UpdatePollingJobInput = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  is_active: z.boolean().optional(),
  interval_minutes: z.number().int().min(1).max(1440).optional(),
  feed_filters: z.object({
    feed_ids: z.array(z.string()).optional(),
    categories: z.array(z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"])).optional(),
    languages: z.array(z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"])).optional(),
    regions: z.array(z.string()).optional(),
    types: z.array(z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"])).optional()
  }).optional()
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

export const ManualPollInput = z.object({
  feed_filters: z.object({
    feed_ids: z.array(z.string()).optional(),
    categories: z.array(z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"])).optional(),
    languages: z.array(z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"])).optional(),
    regions: z.array(z.string()).optional(),
    types: z.array(z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"])).optional()
  }).optional()
});

export type PollingStatusType = z.infer<typeof PollingStatus>;
export type StartPollingInputType = z.infer<typeof StartPollingInput>;
export type UpdatePollingIntervalInputType = z.infer<typeof UpdatePollingIntervalInput>;
export type PollTriggerResponseType = z.infer<typeof PollTriggerResponse>;
export type ActiveFeedStatusType = z.infer<typeof ActiveFeedStatus>;
export type ActiveFeedsStatusResponseType = z.infer<typeof ActiveFeedsStatusResponse>;
export type PollingJobType = z.infer<typeof PollingJob>;
export type CreatePollingJobInputType = z.infer<typeof CreatePollingJobInput>;
export type UpdatePollingJobInputType = z.infer<typeof UpdatePollingJobInput>;
export type PollingJobsResponseType = z.infer<typeof PollingJobsResponse>;
export type ManualPollInputType = z.infer<typeof ManualPollInput>;