import { z } from "zod";

export const PaginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20)
});

export const PaginatedResponse = <T extends z.ZodTypeAny>(itemSchema: T) => z.object({
  data: z.array(itemSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    total_pages: z.number().int().min(0)
  })
});

export const HealthCheck = z.object({
  ok: z.boolean(),
  timestamp: z.string().datetime(),
  uptime: z.number()
});

export const ReadinessCheck = z.object({
  ready: z.boolean(),
  database: z.boolean(),
  timestamp: z.string().datetime()
});

export const ErrorResponse = z.object({
  type: z.string().default("about:blank"),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional()
});

export type PaginationQuery = z.infer<typeof PaginationQuery>;
export type HealthCheck = z.infer<typeof HealthCheck>;
export type ReadinessCheck = z.infer<typeof ReadinessCheck>;
export type ErrorResponse = z.infer<typeof ErrorResponse>;