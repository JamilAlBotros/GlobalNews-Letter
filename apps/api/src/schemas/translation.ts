import { z } from "zod";

export const TranslationJob = z.object({
  id: z.string(),
  article_id: z.string(),
  article_title: z.string(),
  source_language: z.enum(["en", "es", "ar", "pt", "fr", "zh", "ja"]),
  target_languages: z.string(),
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  progress_percentage: z.number().min(0).max(100),
  assigned_worker: z.string().nullable(),
  retry_count: z.number().int().min(0),
  max_retries: z.number().int().min(0),
  estimated_completion: z.string().datetime().nullable(),
  started_at: z.string().datetime().nullable(),
  completed_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  error_message: z.string().nullable(),
  word_count: z.number().int().min(0),
  cost_estimate: z.number().min(0).nullable()
});

export const CreateTranslationJobInput = z.object({
  article_id: z.string(),
  target_languages: z.array(z.enum(["en", "es", "ar", "pt", "fr", "zh", "ja"])).min(1),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal")
});

export const UpdateTranslationJobInput = z.object({
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  progress_percentage: z.number().min(0).max(100).optional(),
  assigned_worker: z.string().nullable().optional(),
  error_message: z.string().nullable().optional()
});

export type TranslationJobType = z.infer<typeof TranslationJob>;
export type CreateTranslationJobInputType = z.infer<typeof CreateTranslationJobInput>;
export type UpdateTranslationJobInputType = z.infer<typeof UpdateTranslationJobInput>;