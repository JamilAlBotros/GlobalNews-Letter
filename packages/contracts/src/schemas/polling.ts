import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const PollingStatus = z.object({
  is_running: z.boolean().openapi({ description: "Whether polling is currently active" }),
  interval_minutes: z.number().int().min(1).openapi({ description: "Polling interval in minutes" }),
  last_poll_time: z.string().datetime().nullable().openapi({ description: "Last successful poll timestamp" }),
  next_poll_time: z.string().datetime().nullable().openapi({ description: "Next scheduled poll timestamp" }),
  total_polls: z.number().int().min(0).openapi({ description: "Total polls executed" }),
  successful_polls: z.number().int().min(0).openapi({ description: "Successful polls count" }),
  failed_polls: z.number().int().min(0).openapi({ description: "Failed polls count" }),
  active_feeds_count: z.number().int().min(0).openapi({ description: "Number of active feeds" })
}).openapi("PollingStatus");

export const StartPollingInput = z.object({
  interval_minutes: z.number().int().min(1).max(1440).optional().openapi({ description: "Polling interval in minutes (1-1440)" })
}).openapi("StartPollingInput");

export const UpdatePollingIntervalInput = z.object({
  interval_minutes: z.number().int().min(1).max(1440).openapi({ description: "New polling interval in minutes (1-1440)" })
}).openapi("UpdatePollingIntervalInput");

export const PollTriggerResponse = z.object({
  success: z.boolean().openapi({ description: "Whether the poll was triggered successfully" }),
  message: z.string().openapi({ description: "Status message" }),
  feeds_processed: z.number().int().min(0).openapi({ description: "Number of feeds processed" }),
  articles_found: z.number().int().min(0).openapi({ description: "Number of new articles found" }),
  timestamp: z.string().datetime().openapi({ description: "Poll execution timestamp" })
}).openapi("PollTriggerResponse");

export const ActiveFeedStatus = z.object({
  feed_id: z.string().openapi({ description: "Feed identifier" }),
  feed_name: z.string().openapi({ description: "Feed display name" }),
  feed_url: z.string().url().openapi({ description: "Feed RSS URL" }),
  status: z.enum(["healthy", "warning", "critical", "unknown"]).openapi({ description: "Feed health status" }),
  last_fetch_time: z.string().datetime().nullable().openapi({ description: "Last successful fetch timestamp" }),
  next_fetch_time: z.string().datetime().nullable().openapi({ description: "Next scheduled fetch timestamp" }),
  success_rate: z.number().min(0).max(1).openapi({ description: "Success rate as decimal (0-1)" }),
  consecutive_failures: z.number().int().min(0).openapi({ description: "Number of consecutive failures" }),
  total_fetches_24h: z.number().int().min(0).openapi({ description: "Total fetch attempts in last 24 hours" }),
  successful_fetches_24h: z.number().int().min(0).openapi({ description: "Successful fetches in last 24 hours" }),
  avg_response_time: z.number().min(0).openapi({ description: "Average response time in milliseconds" }),
  articles_fetched_24h: z.number().int().min(0).openapi({ description: "Articles fetched in last 24 hours" })
}).openapi("ActiveFeedStatus");

export const ActiveFeedsStatusResponse = z.object({
  polling_active: z.boolean().openapi({ description: "Whether polling is currently running" }),
  feeds: z.array(ActiveFeedStatus).openapi({ description: "Status of all active feeds" }),
  summary: z.object({
    total_active_feeds: z.number().int().min(0).openapi({ description: "Total number of active feeds" }),
    healthy_feeds: z.number().int().min(0).openapi({ description: "Number of healthy feeds" }),
    warning_feeds: z.number().int().min(0).openapi({ description: "Number of feeds with warnings" }),
    critical_feeds: z.number().int().min(0).openapi({ description: "Number of critical feeds" }),
    avg_success_rate: z.number().min(0).max(1).openapi({ description: "Average success rate across all feeds" })
  }).openapi({ description: "Summary statistics" })
}).openapi("ActiveFeedsStatusResponse");

export type PollingStatusType = z.infer<typeof PollingStatus>;
export type StartPollingInputType = z.infer<typeof StartPollingInput>;
export type UpdatePollingIntervalInputType = z.infer<typeof UpdatePollingIntervalInput>;
export type PollTriggerResponseType = z.infer<typeof PollTriggerResponse>;
export type ActiveFeedStatusType = z.infer<typeof ActiveFeedStatus>;
export type ActiveFeedsStatusResponseType = z.infer<typeof ActiveFeedsStatusResponse>;