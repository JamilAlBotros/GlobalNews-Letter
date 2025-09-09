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

// Enhanced categories for comprehensive taxonomy system
export const ContentCategory = z.enum([
  'finance', 'tech', 'politics', 'health', 'science', 'sports', 
  'entertainment', 'business', 'education', 'travel', 'lifestyle',
  'gaming', 'crypto', 'environment', 'opinion', 'breaking'
]);

export const CategorizationResponse = z.object({
  primary_category: ContentCategory,
  confidence: z.number().min(0).max(1),
  secondary_categories: z.array(z.object({
    category: ContentCategory,
    confidence: z.number().min(0).max(1)
  })).optional(),
  tags: z.array(z.string()).optional(),
  model: z.string(),
  processing_time_ms: z.number(),
  reasoning: z.string().optional()
}).openapi('CategorizationResponse');

// Sentiment Analysis schemas
export const SentimentAnalysisRequestInput = z.object({
  text: z.string().min(1).max(10000),
  title: z.string().optional(),
  language: SupportedLanguage.optional()
}).openapi('SentimentAnalysisRequestInput');

export const SentimentAnalysisResponse = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
  confidence: z.number().min(0).max(1),
  sentiment_scores: z.object({
    positive: z.number().min(0).max(1),
    negative: z.number().min(0).max(1),
    neutral: z.number().min(0).max(1)
  }),
  emotional_indicators: z.array(z.string()).optional(),
  model: z.string(),
  processing_time_ms: z.number()
}).openapi('SentimentAnalysisResponse');

// Bias Detection schemas
export const BiasDetectionRequestInput = z.object({
  text: z.string().min(1).max(15000),
  title: z.string().optional(),
  language: SupportedLanguage.optional()
}).openapi('BiasDetectionRequestInput');

export const BiasDetectionResponse = z.object({
  overall_bias_score: z.number().min(0).max(1), // 0 = neutral, 1 = highly biased
  bias_types: z.array(z.object({
    type: z.enum(['political', 'demographic', 'confirmation', 'selection', 'emotional', 'commercial']),
    severity: z.enum(['low', 'moderate', 'high']),
    confidence: z.number().min(0).max(1),
    indicators: z.array(z.string()).optional()
  })),
  political_leaning: z.enum(['left', 'center-left', 'center', 'center-right', 'right', 'neutral']).optional(),
  factual_vs_opinion_score: z.number().min(0).max(1), // 0 = pure opinion, 1 = factual
  language_tone: z.enum(['objective', 'subjective', 'inflammatory', 'sensational', 'balanced']),
  model: z.string(),
  processing_time_ms: z.number(),
  recommendations: z.array(z.string()).optional()
}).openapi('BiasDetectionResponse');

// Enhanced Tagging and Topic Extraction
export const TopicExtractionRequestInput = z.object({
  text: z.string().min(1).max(15000),
  title: z.string().optional(),
  max_topics: z.number().min(3).max(20).default(10),
  language: SupportedLanguage.optional()
}).openapi('TopicExtractionRequestInput');

export const TopicExtractionResponse = z.object({
  topics: z.array(z.object({
    topic: z.string(),
    relevance_score: z.number().min(0).max(1),
    category: ContentCategory.optional()
  })),
  entities: z.array(z.object({
    entity: z.string(),
    type: z.enum(['person', 'organization', 'location', 'product', 'event', 'concept']),
    confidence: z.number().min(0).max(1)
  })).optional(),
  keywords: z.array(z.object({
    keyword: z.string(),
    importance: z.number().min(0).max(1)
  })),
  model: z.string(),
  processing_time_ms: z.number()
}).openapi('TopicExtractionResponse');

// Comprehensive Content Analysis (combines multiple analyses)
export const ContentAnalysisRequestInput = z.object({
  text: z.string().min(1).max(15000),
  title: z.string().optional(),
  url: z.string().url().optional(),
  language: SupportedLanguage.optional(),
  analysis_types: z.array(z.enum([
    'summarization', 'sentiment', 'bias', 'quality', 'categorization', 'topics', 'all'
  ])).default(['all'])
}).openapi('ContentAnalysisRequestInput');

export const ContentAnalysisResponse = z.object({
  summary: SummarizationResponse.optional(),
  sentiment: SentimentAnalysisResponse.optional(),
  bias: BiasDetectionResponse.optional(),
  quality: QualityAssessmentResponse.optional(),
  categorization: CategorizationResponse.optional(),
  topics: TopicExtractionResponse.optional(),
  overall_processing_time_ms: z.number(),
  analysis_timestamp: z.string().datetime()
}).openapi('ContentAnalysisResponse');

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

// New Advanced Content Tools types
export type ContentCategoryType = z.infer<typeof ContentCategory>;
export type SentimentAnalysisRequestInputType = z.infer<typeof SentimentAnalysisRequestInput>;
export type SentimentAnalysisResponseType = z.infer<typeof SentimentAnalysisResponse>;
export type BiasDetectionRequestInputType = z.infer<typeof BiasDetectionRequestInput>;
export type BiasDetectionResponseType = z.infer<typeof BiasDetectionResponse>;
export type TopicExtractionRequestInputType = z.infer<typeof TopicExtractionRequestInput>;
export type TopicExtractionResponseType = z.infer<typeof TopicExtractionResponse>;
export type ContentAnalysisRequestInputType = z.infer<typeof ContentAnalysisRequestInput>;
export type ContentAnalysisResponseType = z.infer<typeof ContentAnalysisResponse>;

// Batch processing for advanced content tools
export const BatchContentAnalysisRequestInput = z.object({
  articles: z.array(z.object({
    id: z.string(),
    text: z.string().min(1).max(15000),
    title: z.string().optional(),
    url: z.string().optional()
  })).min(1).max(5),
  analysis_types: z.array(z.enum(['summarization', 'sentiment', 'bias', 'quality', 'categorization', 'topics', 'all'])).default(['all'])
}).openapi('BatchContentAnalysisRequestInput');

export const BatchContentAnalysisResponse = z.object({
  results: z.array(z.object({
    article_id: z.string(),
    analysis: ContentAnalysisResponse,
    success: z.boolean(),
    error: z.string().optional()
  })),
  total_processing_time_ms: z.number(),
  successful_analyses: z.number(),
  failed_analyses: z.number()
}).openapi('BatchContentAnalysisResponse');

export type BatchContentAnalysisRequestInputType = z.infer<typeof BatchContentAnalysisRequestInput>;
export type BatchContentAnalysisResponseType = z.infer<typeof BatchContentAnalysisResponse>;