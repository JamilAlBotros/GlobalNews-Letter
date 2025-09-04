import { z } from "zod";

export const Feed = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url(),
  language: z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"]),
  region: z.string().min(1),
  category: z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"]),
  type: z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"]),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const CreateFeedInput = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  language: z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"]),
  region: z.string().min(1),
  category: z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"]),
  type: z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"]),
  description: z.string().optional(),
  is_active: z.boolean().default(true)
});

export const UpdateFeedInput = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  language: z.enum(["English", "Spanish", "Arabic", "Portuguese", "French", "Chinese", "Japanese"]).optional(),
  region: z.string().min(1).optional(),
  category: z.enum(["News", "Technology", "Finance", "Science", "Sports", "Entertainment", "Health", "Travel", "Education", "Business", "Politics", "Gaming", "Crypto", "Lifestyle"]).optional(),
  type: z.enum(["News", "Analysis", "Blog", "Tutorial", "Recipe", "Review", "Research"]).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional()
});

export type Feed = z.infer<typeof Feed>;
export type CreateFeedInput = z.infer<typeof CreateFeedInput>;
export type UpdateFeedInput = z.infer<typeof UpdateFeedInput>;