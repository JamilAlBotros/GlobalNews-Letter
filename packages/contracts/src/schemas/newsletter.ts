// Newsletter Management Schemas
import { z } from "zod";
import { SupportedLanguage } from "./llm.js";

// Newsletter Issue
export const NewsletterIssue = z.object({
  id: z.string().uuid(),
  issue_number: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  publish_date: z.string().datetime(),
  status: z.enum(['draft', 'published', 'archived']),
  language: SupportedLanguage.default('en'),
  content_metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  published_at: z.string().datetime().optional()
}).openapi('NewsletterIssue');

export const CreateNewsletterInput = z.object({
  title: z.string().min(1).max(200),
  subtitle: z.string().max(500).optional(),
  publish_date: z.string().datetime(),
  language: SupportedLanguage.default('en'),
  content_metadata: z.record(z.any()).optional()
}).openapi('CreateNewsletterInput');

export const UpdateNewsletterInput = z.object({
  title: z.string().min(1).max(200).optional(),
  subtitle: z.string().max(500).optional(),
  publish_date: z.string().datetime().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  language: SupportedLanguage.optional(),
  content_metadata: z.record(z.any()).optional()
}).openapi('UpdateNewsletterInput');

// Newsletter Section
export const NewsletterSection = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  display_name: z.string().min(1),
  section_type: z.enum(['header', 'top_news', 'market_trends', 'footer', 'custom']),
  template_content: z.string(),
  is_recurring: z.boolean().default(false),
  display_order: z.number().int().default(0),
  metadata: z.record(z.any()).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
}).openapi('NewsletterSection');

export const CreateNewsletterSectionInput = z.object({
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  section_type: z.enum(['header', 'top_news', 'market_trends', 'footer', 'custom']),
  template_content: z.string().min(1),
  is_recurring: z.boolean().default(false),
  display_order: z.number().int().default(0),
  metadata: z.record(z.any()).optional()
}).openapi('CreateNewsletterSectionInput');

// Newsletter Relations
export const NewsletterRelation = z.object({
  id: z.string().uuid(),
  source_newsletter_id: z.string().uuid(),
  target_newsletter_id: z.string().uuid(),
  relation_type: z.enum(['previous', 'next', 'related']),
  created_at: z.string().datetime()
}).openapi('NewsletterRelation');

export const CreateNewsletterRelationInput = z.object({
  target_newsletter_id: z.string().uuid(),
  relation_type: z.enum(['previous', 'next', 'related'])
}).openapi('CreateNewsletterRelationInput');

// Article Assignment
export const NewsletterArticleAssignment = z.object({
  id: z.string().uuid(),
  newsletter_id: z.string().uuid(),
  article_id: z.string().uuid(),
  section_id: z.string().uuid().optional(),
  position: z.number().int().default(0),
  custom_title: z.string().optional(),
  custom_description: z.string().optional(),
  created_at: z.string().datetime()
}).openapi('NewsletterArticleAssignment');

export const AssignArticleInput = z.object({
  article_id: z.string().uuid(),
  section_id: z.string().uuid().optional(),
  position: z.number().int().default(0),
  custom_title: z.string().optional(),
  custom_description: z.string().optional()
}).openapi('AssignArticleInput');

// Response schemas
export const NewsletterListResponse = z.object({
  data: z.array(NewsletterIssue),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    total_pages: z.number().int()
  })
}).openapi('NewsletterListResponse');

export const NewsletterSectionListResponse = z.object({
  data: z.array(NewsletterSection)
}).openapi('NewsletterSectionListResponse');

export const NewsletterRelationListResponse = z.object({
  data: z.array(NewsletterRelation)
}).openapi('NewsletterRelationListResponse');

// Export types
export type NewsletterIssueType = z.infer<typeof NewsletterIssue>;
export type CreateNewsletterInputType = z.infer<typeof CreateNewsletterInput>;
export type UpdateNewsletterInputType = z.infer<typeof UpdateNewsletterInput>;
export type NewsletterSectionType = z.infer<typeof NewsletterSection>;
export type CreateNewsletterSectionInputType = z.infer<typeof CreateNewsletterSectionInput>;
export type NewsletterRelationType = z.infer<typeof NewsletterRelation>;
export type CreateNewsletterRelationInputType = z.infer<typeof CreateNewsletterRelationInput>;
export type NewsletterArticleAssignmentType = z.infer<typeof NewsletterArticleAssignment>;
export type AssignArticleInputType = z.infer<typeof AssignArticleInput>;
export type NewsletterListResponseType = z.infer<typeof NewsletterListResponse>;