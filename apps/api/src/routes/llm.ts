import { FastifyInstance } from "fastify";
import { z } from "zod";
import { 
  TranslationRequestInput,
  TranslationResponse,
  SummarizationRequestInput,
  SummarizationResponse,
  LanguageDetectionRequestInput,
  LanguageDetectionResponse,
  CategorizationRequestInput,
  CategorizationResponse,
  QualityAssessmentRequestInput,
  QualityAssessmentResponse,
  BatchTranslationRequestInput,
  BatchTranslationResponse,
  LLMHealthCheckResponse,
  TranslationRequestInputType,
  TranslationResponseType,
  SummarizationRequestInputType,
  SummarizationResponseType,
  LanguageDetectionRequestInputType,
  LanguageDetectionResponseType,
  CategorizationRequestInputType,
  CategorizationResponseType,
  QualityAssessmentRequestInputType,
  QualityAssessmentResponseType,
  BatchTranslationRequestInputType,
  BatchTranslationResponseType,
  LLMHealthCheckResponseType
} from "../schemas/llm.js";
import { LLMService } from "../services/llm.js";
import { ErrorHandler } from "../utils/errors.js";

export async function llmRoutes(app: FastifyInstance): Promise<void> {
  const llmService = new LLMService();

  // Translation endpoint
  app.post("/llm/translate", async (request, reply) => {
    const body = TranslationRequestInput.parse(request.body);
    
    try {
      const result = await llmService.translateText({
        text: body.text,
        sourceLanguage: body.source_language,
        targetLanguage: body.target_language,
        contentType: body.content_type,
        context: body.context
      });

      const response: TranslationResponseType = {
        translated_text: result.translatedText,
        quality_score: result.qualityScore,
        confidence: result.confidence,
        detected_language: result.detectedLanguage,
        model: result.model,
        processing_time_ms: result.processingTimeMs
      };

      return reply.code(200).send(response);
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'translate_text',
        sourceLanguage: body.source_language,
        targetLanguage: body.target_language
      });

      throw Object.assign(new Error("Translation failed"), {
        status: 500,
        detail: `Failed to translate text: ${(error as Error).message}`
      });
    }
  });

  // Batch translation endpoint
  app.post("/llm/translate/batch", async (request, reply) => {
    const body = BatchTranslationRequestInput.parse(request.body);
    
    try {
      const startTime = Date.now();
      const requests = body.requests.map(req => ({
        text: req.text,
        sourceLanguage: req.source_language,
        targetLanguage: req.target_language,
        contentType: req.content_type,
        context: req.context
      }));

      const results = await llmService.batchTranslate(requests);
      const totalProcessingTime = Date.now() - startTime;

      const response: BatchTranslationResponseType = {
        results: results.map(result => ({
          translated_text: result.translatedText,
          quality_score: result.qualityScore,
          confidence: result.confidence,
          detected_language: result.detectedLanguage,
          model: result.model,
          processing_time_ms: result.processingTimeMs
        })),
        total_processing_time_ms: totalProcessingTime,
        successful_translations: results.length,
        failed_translations: body.requests.length - results.length
      };

      return reply.code(200).send(response);
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'batch_translate',
        requestCount: body.requests.length
      });

      throw Object.assign(new Error("Batch translation failed"), {
        status: 500,
        detail: `Failed to process batch translation: ${(error as Error).message}`
      });
    }
  });

  // Summarization endpoint
  app.post("/llm/summarize", async (request, reply) => {
    const body = SummarizationRequestInput.parse(request.body);
    
    try {
      const result = await llmService.summarizeText({
        text: body.text,
        language: body.language,
        maxLength: body.max_length,
        style: body.style
      });

      const response: SummarizationResponseType = {
        summary: result.summary,
        key_points: result.keyPoints,
        model: result.model,
        processing_time_ms: result.processingTimeMs
      };

      return reply.code(200).send(response);
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'summarize_text',
        language: body.language,
        textLength: body.text.length
      });

      throw Object.assign(new Error("Summarization failed"), {
        status: 500,
        detail: `Failed to summarize text: ${(error as Error).message}`
      });
    }
  });

  // Language detection endpoint
  app.post("/llm/detect-language", async (request, reply) => {
    const body = LanguageDetectionRequestInput.parse(request.body);
    
    try {
      const startTime = Date.now();
      const result = await llmService.detectLanguage(body.text);
      const processingTime = Date.now() - startTime;

      const response: LanguageDetectionResponseType = {
        detected_language: result.language,
        confidence: result.confidence,
        model: 'llm-service',
        processing_time_ms: processingTime
      };

      return reply.code(200).send(response);
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'detect_language',
        textLength: body.text.length
      });

      throw Object.assign(new Error("Language detection failed"), {
        status: 500,
        detail: `Failed to detect language: ${(error as Error).message}`
      });
    }
  });

  // Categorization endpoint
  app.post("/llm/categorize", async (request, reply) => {
    const body = CategorizationRequestInput.parse(request.body);
    
    try {
      const startTime = Date.now();
      const result = await llmService.categorizeContent(
        body.text,
        body.title,
        body.language
      );
      const processingTime = Date.now() - startTime;

      const response: CategorizationResponseType = {
        category: result.category,
        confidence: result.confidence,
        model: 'llm-service',
        processing_time_ms: processingTime,
        alternative_categories: result.alternativeCategories,
        reasoning: result.reasoning
      };

      return reply.code(200).send(response);
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'categorize_content',
        textLength: body.text.length,
        hasTitle: !!body.title
      });

      throw Object.assign(new Error("Categorization failed"), {
        status: 500,
        detail: `Failed to categorize content: ${(error as Error).message}`
      });
    }
  });

  // Quality assessment endpoint
  app.post("/llm/assess-quality", async (request, reply) => {
    const body = QualityAssessmentRequestInput.parse(request.body);
    
    try {
      const startTime = Date.now();
      const result = await llmService.assessContentQuality(
        body.text,
        body.title,
        body.url,
        body.language
      );
      const processingTime = Date.now() - startTime;

      const response: QualityAssessmentResponseType = {
        overall_score: result.overallScore,
        readability_score: result.readabilityScore,
        informativeness_score: result.informativenessScore,
        credibility_score: result.credibilityScore,
        engagement_score: result.engagementScore,
        model: 'llm-service',
        processing_time_ms: processingTime,
        assessment_details: {
          word_count: result.assessmentDetails.wordCount,
          sentence_count: result.assessmentDetails.sentenceCount,
          avg_sentence_length: result.assessmentDetails.avgSentenceLength,
          has_proper_structure: result.assessmentDetails.hasProperStructure,
          contains_factual_claims: result.assessmentDetails.containsFactualClaims,
          tone: result.assessmentDetails.tone,
          complexity_level: result.assessmentDetails.complexityLevel
        },
        recommendations: result.recommendations
      };

      return reply.code(200).send(response);
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'assess_quality',
        textLength: body.text.length,
        hasTitle: !!body.title,
        hasUrl: !!body.url
      });

      throw Object.assign(new Error("Quality assessment failed"), {
        status: 500,
        detail: `Failed to assess content quality: ${(error as Error).message}`
      });
    }
  });

  // LLM service health check endpoint
  app.get("/llm/health", async (request, reply) => {
    try {
      const startTime = Date.now();
      const health = await llmService.healthCheck();
      const responseTime = Date.now() - startTime;

      const response: LLMHealthCheckResponseType = {
        status: health.status,
        response_time_ms: health.responseTimeMs || responseTime,
        provider: 'llm-service',
        model: 'llm-service',
        last_checked: new Date().toISOString(),
        error_message: health.status === 'unhealthy' ? 'Service is not responding properly' : undefined
      };

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      return reply.code(statusCode).send(response);
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'llm_health_check' });

      const response: LLMHealthCheckResponseType = {
        status: 'unhealthy',
        provider: 'llm-service',
        model: 'llm-service',
        last_checked: new Date().toISOString(),
        error_message: (error as Error).message
      };

      return reply.code(503).send(response);
    }
  });

  // Article processing endpoint (enhanced version of existing processArticle)
  app.post("/llm/process-article", async (request, reply) => {
    const body = z.object({
      title: z.string(),
      description: z.string().nullable().optional(),
      content: z.string().nullable().optional(),
      target_language: z.enum(['en', 'es', 'pt', 'fr', 'ar', 'zh', 'ja']),
      include_translation: z.boolean().optional().default(false),
      include_categorization: z.boolean().optional().default(false),
      include_quality_assessment: z.boolean().optional().default(false)
    }).parse(request.body);

    try {
      const results: any = {};

      // Always generate summary
      const summaryResult = await llmService.processArticle(
        body.title,
        body.description || null,
        body.content || null,
        body.target_language
      );
      
      results.summary = summaryResult.summary;
      results.translated_title = summaryResult.translatedTitle;

      // Optional categorization
      if (body.include_categorization) {
        const categorizationResult = await llmService.categorizeContent(
          [body.title, body.description, body.content].filter(Boolean).join('\n\n'),
          body.title,
          body.target_language
        );
        results.categorization = {
          category: categorizationResult.category,
          confidence: categorizationResult.confidence,
          reasoning: categorizationResult.reasoning
        };
      }

      // Optional quality assessment
      if (body.include_quality_assessment) {
        const qualityResult = await llmService.assessContentQuality(
          [body.title, body.description, body.content].filter(Boolean).join('\n\n'),
          body.title,
          undefined,
          body.target_language
        );
        results.quality_assessment = {
          overall_score: qualityResult.overallScore,
          readability_score: qualityResult.readabilityScore,
          informativeness_score: qualityResult.informativenessScore,
          credibility_score: qualityResult.credibilityScore,
          engagement_score: qualityResult.engagementScore,
          recommendations: qualityResult.recommendations
        };
      }

      return reply.code(200).send({
        success: true,
        results,
        processing_time_ms: Date.now() - Date.now() // This would need proper timing
      });
    } catch (error) {
      ErrorHandler.logError(error as Error, { 
        operation: 'process_article',
        targetLanguage: body.target_language,
        includeTranslation: body.include_translation,
        includeCategorization: body.include_categorization,
        includeQualityAssessment: body.include_quality_assessment
      });

      throw Object.assign(new Error("Article processing failed"), {
        status: 500,
        detail: `Failed to process article: ${(error as Error).message}`
      });
    }
  });
}