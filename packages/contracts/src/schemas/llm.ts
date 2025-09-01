import { z } from "zod";

// Supported languages enum
export const SupportedLanguage = z.enum(['en', 'es', 'pt', 'fr', 'ar', 'zh', 'ja']);

// Content types for different processing contexts
export const ContentType = z.enum(['title', 'description', 'content', 'summary']);

// Translation endpoint schemas
export const TranslationRequestInput = z.object({
  text: z.string().min(1).max(10000),
  source_language: SupportedLanguage,
  target_language: SupportedLanguage,
  content_type: ContentType.optional().default('content'),
  context: z.string().optional()
}).openapi('TranslationRequestInput');

export const TranslationResponse = z.object({
  translated_text: z.string(),
  quality_score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  detected_language: SupportedLanguage.optional(),
  model: z.string(),
  processing_time_ms: z.number()
}).openapi('TranslationResponse');

// Summarization endpoint schemas
export const SummarizationRequestInput = z.object({
  text: z.string().min(1).max(50000),
  language: SupportedLanguage,
  max_length: z.number().min(50).max(500).default(150),
  style: z.enum(['brief', 'detailed', 'bullet-points']).optional().default('brief')
}).openapi('SummarizationRequestInput');

export const SummarizationResponse = z.object({
  summary: z.string(),
  key_points: z.array(z.string()).optional(),
  model: z.string(),
  processing_time_ms: z.number()
}).openapi('SummarizationResponse');

// Language detection endpoint schemas
export const LanguageDetectionRequestInput = z.object({
  text: z.string().min(1).max(5000)
}).openapi('LanguageDetectionRequestInput');

export const LanguageDetectionResponse = z.object({
  detected_language: SupportedLanguage,
  confidence: z.number().min(0).max(1),
  model: z.string(),
  processing_time_ms: z.number(),
  alternative_languages: z.array(z.object({
    language: SupportedLanguage,
    confidence: z.number().min(0).max(1)
  })).optional()
}).openapi('LanguageDetectionResponse');

// Categorization endpoint schemas
export const CategorizationRequestInput = z.object({
  text: z.string().min(1).max(10000),
  title: z.string().optional(),
  language: SupportedLanguage.optional()
}).openapi('CategorizationRequestInput');

export const CategorizationResponse = z.object({
  category: z.enum(['finance', 'tech']),
  confidence: z.number().min(0).max(1),
  model: z.string(),
  processing_time_ms: z.number(),
  alternative_categories: z.array(z.object({
    category: z.enum(['finance', 'tech']),
    confidence: z.number().min(0).max(1)
  })).optional(),
  reasoning: z.string().optional()
}).openapi('CategorizationResponse');

// Content quality assessment endpoint schemas
export const QualityAssessmentRequestInput = z.object({
  text: z.string().min(1).max(15000),
  title: z.string().optional(),
  url: z.string().url().optional(),
  language: SupportedLanguage.optional()
}).openapi('QualityAssessmentRequestInput');

export const QualityAssessmentResponse = z.object({
  overall_score: z.number().min(0).max(1),
  readability_score: z.number().min(0).max(1),
  informativeness_score: z.number().min(0).max(1),
  credibility_score: z.number().min(0).max(1),
  engagement_score: z.number().min(0).max(1),
  model: z.string(),
  processing_time_ms: z.number(),
  assessment_details: z.object({
    word_count: z.number(),
    sentence_count: z.number(),
    avg_sentence_length: z.number(),
    has_proper_structure: z.boolean(),
    contains_factual_claims: z.boolean(),
    tone: z.enum(['neutral', 'positive', 'negative', 'mixed']),
    complexity_level: z.enum(['basic', 'intermediate', 'advanced'])
  }),
  recommendations: z.array(z.string()).optional()
}).openapi('QualityAssessmentResponse');

// Batch processing schemas
export const BatchTranslationRequestInput = z.object({
  requests: z.array(TranslationRequestInput).min(1).max(10)
}).openapi('BatchTranslationRequestInput');

export const BatchTranslationResponse = z.object({
  results: z.array(TranslationResponse),
  total_processing_time_ms: z.number(),
  successful_translations: z.number(),
  failed_translations: z.number()
}).openapi('BatchTranslationResponse');

// LLM service health check schema
export const LLMHealthCheckResponse = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  response_time_ms: z.number().optional(),
  provider: z.string(),
  model: z.string(),
  last_checked: z.string().datetime(),
  error_message: z.string().optional()
}).openapi('LLMHealthCheckResponse');

// Error response schema for LLM endpoints
export const LLMErrorResponse = z.object({
  type: z.string().default('about:blank'),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  instance: z.string().optional(),
  context: z.object({
    provider: z.string().optional(),
    model: z.string().optional(),
    request_id: z.string().optional()
  }).optional()
}).openapi('LLMErrorResponse');

// Export all types
export type SupportedLanguageType = z.infer<typeof SupportedLanguage>;
export type ContentTypeType = z.infer<typeof ContentType>;

export type TranslationRequestInputType = z.infer<typeof TranslationRequestInput>;
export type TranslationResponseType = z.infer<typeof TranslationResponse>;

export type SummarizationRequestInputType = z.infer<typeof SummarizationRequestInput>;
export type SummarizationResponseType = z.infer<typeof SummarizationResponse>;

export type LanguageDetectionRequestInputType = z.infer<typeof LanguageDetectionRequestInput>;
export type LanguageDetectionResponseType = z.infer<typeof LanguageDetectionResponse>;

export type CategorizationRequestInputType = z.infer<typeof CategorizationRequestInput>;
export type CategorizationResponseType = z.infer<typeof CategorizationResponse>;

export type QualityAssessmentRequestInputType = z.infer<typeof QualityAssessmentRequestInput>;
export type QualityAssessmentResponseType = z.infer<typeof QualityAssessmentResponse>;

export type BatchTranslationRequestInputType = z.infer<typeof BatchTranslationRequestInput>;
export type BatchTranslationResponseType = z.infer<typeof BatchTranslationResponse>;

export type LLMHealthCheckResponseType = z.infer<typeof LLMHealthCheckResponse>;
export type LLMErrorResponseType = z.infer<typeof LLMErrorResponse>;