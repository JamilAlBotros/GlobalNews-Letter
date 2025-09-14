import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const TranslationJob = z.object({
  id: z.string().openapi({ description: "Translation job identifier" }),
  article_id: z.string().openapi({ description: "Source article identifier" }),
  article_title: z.string().openapi({ description: "Article title for display" }),
  source_language: z.enum(["en", "es", "ar", "pt", "fr", "zh", "ja"]).openapi({ description: "Source language code" }),
  target_languages: z.string().openapi({ description: "Comma-separated target language codes" }),
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]).openapi({ description: "Job status" }),
  priority: z.enum(["low", "normal", "high", "urgent"]).openapi({ description: "Job priority" }),
  progress_percentage: z.number().min(0).max(100).openapi({ description: "Translation completion percentage" }),
  assigned_worker: z.string().nullable().openapi({ description: "Worker/service handling the job" }),
  retry_count: z.number().int().min(0).openapi({ description: "Number of retry attempts" }),
  max_retries: z.number().int().min(0).openapi({ description: "Maximum retry attempts allowed" }),
  estimated_completion: z.string().datetime().nullable().openapi({ description: "Estimated completion time" }),
  started_at: z.string().datetime().nullable().openapi({ description: "Job start timestamp" }),
  completed_at: z.string().datetime().nullable().openapi({ description: "Job completion timestamp" }),
  created_at: z.string().datetime().openapi({ description: "Job creation timestamp" }),
  updated_at: z.string().datetime().openapi({ description: "Job last update timestamp" }),
  error_message: z.string().nullable().openapi({ description: "Error message if job failed" }),
  word_count: z.number().int().min(0).openapi({ description: "Estimated word count to translate" }),
  cost_estimate: z.number().min(0).nullable().openapi({ description: "Estimated translation cost" })
}).openapi("TranslationJob");

export const CreateTranslationJobInput = z.object({
  article_id: z.string().openapi({ description: "Source article identifier" }),
  target_languages: z.array(z.enum(["en", "es", "ar", "pt", "fr", "zh", "ja"])).min(1).openapi({ description: "Target language codes" }),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal").openapi({ description: "Job priority" })
}).openapi("CreateTranslationJobInput");

export const UpdateTranslationJobInput = z.object({
  status: z.enum(["queued", "processing", "completed", "failed", "cancelled"]).optional().openapi({ description: "Job status" }),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional().openapi({ description: "Job priority" }),
  progress_percentage: z.number().min(0).max(100).optional().openapi({ description: "Translation completion percentage" }),
  assigned_worker: z.string().nullable().optional().openapi({ description: "Worker/service handling the job" }),
  error_message: z.string().nullable().optional().openapi({ description: "Error message if job failed" })
}).openapi("UpdateTranslationJobInput");

export const TranslationJobsResponse = z.object({
  data: z.array(TranslationJob).openapi({ description: "Translation jobs" }),
  pagination: z.object({
    page: z.number().int().min(1).openapi({ description: "Current page number" }),
    limit: z.number().int().min(1).openapi({ description: "Items per page" }),
    total: z.number().int().min(0).openapi({ description: "Total number of jobs" }),
    total_pages: z.number().int().min(0).openapi({ description: "Total number of pages" })
  }).openapi({ description: "Pagination information" })
}).openapi("TranslationJobsResponse");

export type TranslationJobType = z.infer<typeof TranslationJob>;
export type CreateTranslationJobInputType = z.infer<typeof CreateTranslationJobInput>;
export type UpdateTranslationJobInputType = z.infer<typeof UpdateTranslationJobInput>;
export type TranslationJobsResponseType = z.infer<typeof TranslationJobsResponse>;