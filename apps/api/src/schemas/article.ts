import { z } from "zod";

export const Article = z.object({
  id: z.string().uuid(),
  feed_id: z.string().uuid(),
  title: z.string().min(1),
  detected_language: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  url: z.string().url(),
  published_at: z.string().datetime(),
  scraped_at: z.string().datetime(),
  created_at: z.string().datetime()
});

export const CreateArticleInput = z.object({
  feed_id: z.string().uuid(),
  title: z.string().min(1),
  detected_language: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable(),
  url: z.string().url(),
  published_at: z.string().datetime()
});

export const UpdateArticleInput = z.object({
  title: z.string().min(1).optional(),
  detected_language: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  url: z.string().url().optional(),
  published_at: z.string().datetime().optional()
});

export type Article = z.infer<typeof Article>;
export type CreateArticleInput = z.infer<typeof CreateArticleInput>;
export type UpdateArticleInput = z.infer<typeof UpdateArticleInput>;