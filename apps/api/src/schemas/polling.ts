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

export type PollingStatusType = z.infer<typeof PollingStatus>;
export type StartPollingInputType = z.infer<typeof StartPollingInput>;
export type UpdatePollingIntervalInputType = z.infer<typeof UpdatePollingIntervalInput>;
export type PollTriggerResponseType = z.infer<typeof PollTriggerResponse>;
export type ActiveFeedStatusType = z.infer<typeof ActiveFeedStatus>;
export type ActiveFeedsStatusResponseType = z.infer<typeof ActiveFeedsStatusResponse>;