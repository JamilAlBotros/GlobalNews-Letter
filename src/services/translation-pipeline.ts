import { EnhancedDatabaseService } from './enhanced-database.js';
import { LLMService } from './llm.js';
import { 
  ArticleOriginal, 
  ArticleTranslation, 
  TranslationJob, 
  LanguageCode, 
  JobPriority,
  TranslationStatus,
  JobStatus
} from '../api/schemas/enhanced-schemas.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Translation Pipeline Service
 * Manages bi-directional translation jobs with quality control and adaptive routing
 */

interface TranslationConfig {
  model: string;
  quality_threshold: number;
  human_review_required: boolean;
  max_tokens?: number;
  temperature?: number;
}

interface TranslationResult {
  title_translated: string;
  description_translated?: string;
  content_translated?: string;
  summary_translated?: string;
  quality_score: number;
  confidence: number;
  model_used: string;
  processing_time: number;
}

interface QueueMetrics {
  queued: number;
  processing: number;
  completed_today: number;
  failed_today: number;
  avg_processing_time: number;
  avg_quality_score: number;
}

export class TranslationPipeline {
  private db: EnhancedDatabaseService;
  private llmService: LLMService;
  private isProcessing = false;
  private processingWorkers: Map<string, boolean> = new Map();
  private readonly maxConcurrentJobs = 3;

  // Language pair difficulty matrix (affects processing priority and resource allocation)
  private readonly LANGUAGE_DIFFICULTY: Record<string, Record<string, number>> = {
    'en': { 'es': 0.8, 'pt': 0.8, 'fr': 0.8, 'ar': 0.9, 'zh': 0.95, 'ja': 0.95 },
    'es': { 'en': 0.8, 'pt': 0.7, 'fr': 0.85, 'ar': 0.9, 'zh': 0.95, 'ja': 0.95 },
    'pt': { 'en': 0.8, 'es': 0.7, 'fr': 0.85, 'ar': 0.9, 'zh': 0.95, 'ja': 0.95 },
    'fr': { 'en': 0.8, 'es': 0.85, 'pt': 0.85, 'ar': 0.9, 'zh': 0.95, 'ja': 0.95 },
    'ar': { 'en': 0.9, 'es': 0.9, 'pt': 0.9, 'fr': 0.9, 'zh': 0.95, 'ja': 0.95 },
    'zh': { 'en': 0.95, 'es': 0.95, 'pt': 0.95, 'fr': 0.95, 'ar': 0.95, 'ja': 0.9 },
    'ja': { 'en': 0.95, 'es': 0.95, 'pt': 0.95, 'fr': 0.95, 'ar': 0.95, 'zh': 0.9 }
  };

  // Default translation configurations by priority
  private readonly DEFAULT_CONFIGS: Record<JobPriority, TranslationConfig> = {
    urgent: {
      model: 'gpt-4',
      quality_threshold: 0.7,
      human_review_required: false,
      max_tokens: 4000,
      temperature: 0.1
    },
    high: {
      model: 'gpt-3.5-turbo',
      quality_threshold: 0.75,
      human_review_required: false,
      max_tokens: 3000,
      temperature: 0.2
    },
    normal: {
      model: 'gpt-3.5-turbo',
      quality_threshold: 0.8,
      human_review_required: false,
      max_tokens: 2500,
      temperature: 0.3
    },
    low: {
      model: 'gpt-3.5-turbo',
      quality_threshold: 0.85,
      human_review_required: true,
      max_tokens: 2000,
      temperature: 0.4
    }
  };

  constructor(databaseService: EnhancedDatabaseService, llmService: LLMService) {
    this.db = databaseService;
    this.llmService = llmService;
  }

  /**
   * Create translation jobs for an article
   */
  async createTranslationJobs(
    articleId: string,
    targetLanguages: LanguageCode[],
    priority: JobPriority = 'normal',
    customConfig?: Partial<TranslationConfig>
  ): Promise<string[]> {
    const article = await this.db.getArticlesForTranslation(1, undefined, undefined);
    const targetArticle = article.find(a => a.id === articleId);
    
    if (!targetArticle) {
      throw new Error(`Article not found: ${articleId}`);
    }

    const jobIds: string[] = [];
    
    // Create translation job
    const jobId = uuidv4();
    const config = { ...this.DEFAULT_CONFIGS[priority], ...customConfig };
    
    const translationJob: Omit<TranslationJob, 'created_at' | 'updated_at'> = {
      id: jobId,
      original_article_id: articleId,
      target_languages: JSON.stringify(targetLanguages),
      priority,
      status: 'queued',
      translation_config: JSON.stringify(config),
      max_retries: 3,
      retry_count: 0,
      estimated_completion: this.calculateEstimatedCompletion(
        targetArticle,
        targetLanguages,
        priority
      )
    };

    await this.db.createTranslationJob(translationJob);
    jobIds.push(jobId);

    console.log(`Created translation job ${jobId} for article ${articleId} -> [${targetLanguages.join(', ')}]`);
    return jobIds;
  }

  /**
   * Start the translation pipeline processor
   */
  async startPipeline(): Promise<void> {
    if (this.isProcessing) {
      console.log('Translation pipeline already running');
      return;
    }

    this.isProcessing = true;
    console.log('Starting translation pipeline...');

    // Run the processing loop
    this.processingLoop();
  }

  /**
   * Stop the translation pipeline processor
   */
  async stopPipeline(): Promise<void> {
    console.log('Stopping translation pipeline...');
    this.isProcessing = false;
    
    // Wait for current jobs to complete
    while (this.processingWorkers.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('Translation pipeline stopped');
  }

  /**
   * Main processing loop
   */
  private async processingLoop(): Promise<void> {
    while (this.isProcessing) {
      try {
        // Check if we can process more jobs
        if (this.processingWorkers.size >= this.maxConcurrentJobs) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }

        // Get next job from queue
        const jobs = await this.db.getQueuedTranslationJobs(1);
        if (jobs.length === 0) {
          // No jobs available, wait and continue
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }

        const job = jobs[0];
        const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Mark worker as busy and process job
        this.processingWorkers.set(workerId, true);
        this.processTranslationJob(job, workerId)
          .finally(() => {
            this.processingWorkers.delete(workerId);
          });

      } catch (error) {
        console.error('Error in translation processing loop:', error);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait longer on errors
      }
    }
  }

  /**
   * Process a single translation job
   */
  private async processTranslationJob(job: TranslationJob, workerId: string): Promise<void> {
    try {
      console.log(`Worker ${workerId} processing translation job ${job.id}`);
      
      // Update job status
      await this.db.updateTranslationJobStatus(job.id, 'processing', {
        assignedWorker: workerId
      });

      // Get the original article
      const articles = await this.db.getArticlesForTranslation(1);
      const article = articles.find(a => a.id === job.original_article_id);
      
      if (!article) {
        throw new Error(`Article not found: ${job.original_article_id}`);
      }

      // Parse target languages and configuration
      const targetLanguages: LanguageCode[] = JSON.parse(job.target_languages);
      const config: TranslationConfig = job.translation_config 
        ? JSON.parse(job.translation_config)
        : this.DEFAULT_CONFIGS[job.priority];

      // Process translations for each target language
      const translationResults: Array<{language: LanguageCode, result: TranslationResult}> = [];
      
      for (const targetLang of targetLanguages) {
        try {
          const result = await this.translateArticle(article, targetLang, config);
          translationResults.push({ language: targetLang, result });
          
          // Save translation to database
          await this.saveTranslation(article, targetLang, result, job.id);
          
        } catch (translationError) {
          console.error(`Translation failed for ${article.id} -> ${targetLang}:`, translationError);
          
          // Save failed translation record
          await this.saveFailedTranslation(article, targetLang, translationError, job.id);
        }
      }

      // Update article processing stage
      if (translationResults.length > 0) {
        await this.db.updateArticleProcessingStage(article.id, 'translated');
      }

      // Mark job as completed
      await this.db.updateTranslationJobStatus(job.id, 'completed');
      
      console.log(`Translation job ${job.id} completed successfully`);

    } catch (error) {
      console.error(`Translation job ${job.id} failed:`, error);
      
      // Update job status and retry count
      if (job.retry_count < job.max_retries) {
        // Will be retried later by maintenance job
        await this.db.updateTranslationJobStatus(job.id, 'failed');
      } else {
        // Max retries reached, mark as permanently failed
        await this.db.updateTranslationJobStatus(job.id, 'cancelled');
      }
    }
  }

  /**
   * Translate a single article to target language
   */
  private async translateArticle(
    article: ArticleOriginal,
    targetLanguage: LanguageCode,
    config: TranslationConfig
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    
    // Build translation prompt
    const prompt = this.buildTranslationPrompt(article, targetLanguage, config);
    
    // Call LLM service
    const response = await this.llmService.generateResponse(prompt, {
      model: config.model,
      maxTokens: config.max_tokens,
      temperature: config.temperature
    });

    // Parse and validate translation response
    const translationData = this.parseTranslationResponse(response);
    
    // Calculate quality metrics
    const qualityScore = await this.calculateTranslationQuality(
      article,
      translationData,
      targetLanguage
    );

    const processingTime = Date.now() - startTime;
    
    return {
      ...translationData,
      quality_score: qualityScore,
      confidence: qualityScore, // Simplified - could be more sophisticated
      model_used: config.model,
      processing_time: processingTime
    };
  }

  /**
   * Build translation prompt for LLM
   */
  private buildTranslationPrompt(
    article: ArticleOriginal,
    targetLanguage: LanguageCode,
    config: TranslationConfig
  ): string {
    const languageNames: Record<LanguageCode, string> = {
      'en': 'English',
      'es': 'Spanish', 
      'ar': 'Arabic',
      'pt': 'Portuguese',
      'fr': 'French',
      'zh': 'Chinese',
      'ja': 'Japanese'
    };

    const sourceLanguage = languageNames[article.detected_language] || 'the source language';
    const targetLanguageName = languageNames[targetLanguage];

    return `
Translate the following news article from ${sourceLanguage} to ${targetLanguageName}. 
Maintain the journalistic tone and preserve all important information.

ORIGINAL ARTICLE:
Title: ${article.title}
${article.description ? `Description: ${article.description}` : ''}
${article.content ? `Content: ${article.content.substring(0, 2000)}...` : ''}

REQUIREMENTS:
- Translate accurately while maintaining context and meaning
- Preserve proper nouns, company names, and technical terms appropriately
- Maintain the original article structure
- Ensure cultural appropriateness for ${targetLanguageName} readers
- Quality threshold: ${config.quality_threshold}

Please respond with a JSON object containing:
{
  "title_translated": "translated title",
  "description_translated": "translated description (if provided)",
  "content_translated": "translated content (if provided)",
  "summary_translated": "brief summary in target language"
}
    `.trim();
  }

  /**
   * Parse LLM response into structured translation data
   */
  private parseTranslationResponse(response: string): Omit<TranslationResult, 'quality_score' | 'confidence' | 'model_used' | 'processing_time'> {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in translation response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        title_translated: parsed.title_translated || '',
        description_translated: parsed.description_translated,
        content_translated: parsed.content_translated,
        summary_translated: parsed.summary_translated
      };

    } catch (error) {
      console.error('Failed to parse translation response:', error);
      
      // Fallback: try to extract title from first line
      const lines = response.split('\n').filter(line => line.trim());
      const title = lines[0] || 'Translation failed';
      
      return {
        title_translated: title,
        description_translated: lines[1] || undefined,
        content_translated: lines.slice(2).join('\n') || undefined,
        summary_translated: undefined
      };
    }
  }

  /**
   * Calculate translation quality score
   */
  private async calculateTranslationQuality(
    original: ArticleOriginal,
    translation: any,
    targetLanguage: LanguageCode
  ): Promise<number> {
    let score = 0.5; // Base score
    
    // Content completeness (30% weight)
    if (translation.title_translated && translation.title_translated.length > 0) score += 0.15;
    if (translation.description_translated && translation.description_translated.length > 0) score += 0.10;
    if (translation.content_translated && translation.content_translated.length > 0) score += 0.05;
    
    // Length ratio analysis (20% weight)
    const originalLength = (original.title + ' ' + (original.description || '') + ' ' + (original.content || '')).length;
    const translatedLength = (translation.title_translated + ' ' + (translation.description_translated || '') + ' ' + (translation.content_translated || '')).length;
    
    if (originalLength > 0) {
      const lengthRatio = translatedLength / originalLength;
      if (lengthRatio >= 0.7 && lengthRatio <= 1.5) {
        score += 0.20;
      } else if (lengthRatio >= 0.5 && lengthRatio <= 2.0) {
        score += 0.10;
      }
    }
    
    // Language difficulty penalty (10% weight)
    const difficulty = this.LANGUAGE_DIFFICULTY[original.detected_language]?.[targetLanguage] || 0.8;
    score *= difficulty;
    
    // Word count check (10% weight)
    const translatedWordCount = this.countWords(translation.title_translated + ' ' + (translation.content_translated || ''));
    if (translatedWordCount > 10) score += 0.10;
    
    return Math.min(Math.max(score, 0.0), 1.0);
  }

  /**
   * Save successful translation to database
   */
  private async saveTranslation(
    article: ArticleOriginal,
    targetLanguage: LanguageCode,
    result: TranslationResult,
    jobId: string
  ): Promise<void> {
    const translationId = uuidv4();
    
    const translation: Omit<ArticleTranslation, 'created_at' | 'updated_at'> = {
      id: translationId,
      original_article_id: article.id,
      target_language: targetLanguage,
      title_translated: result.title_translated,
      description_translated: result.description_translated,
      content_translated: result.content_translated,
      summary_translated: result.summary_translated,
      translation_method: 'ai',
      translator_model: result.model_used,
      translation_quality_score: result.quality_score,
      translation_confidence: result.confidence,
      human_reviewed: false,
      translation_started_at: new Date(Date.now() - result.processing_time).toISOString(),
      translation_completed_at: new Date().toISOString(),
      translation_status: result.quality_score >= 0.7 ? 'completed' : 'review_needed'
    };

    await this.db.saveArticleTranslation(translation);
  }

  /**
   * Save failed translation record
   */
  private async saveFailedTranslation(
    article: ArticleOriginal,
    targetLanguage: LanguageCode,
    error: any,
    jobId: string
  ): Promise<void> {
    const translationId = uuidv4();
    
    const translation: Omit<ArticleTranslation, 'created_at' | 'updated_at'> = {
      id: translationId,
      original_article_id: article.id,
      target_language: targetLanguage,
      title_translated: 'Translation failed',
      translation_method: 'ai',
      human_reviewed: false,
      translation_status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      translation_started_at: new Date().toISOString()
    };

    await this.db.saveArticleTranslation(translation);
  }

  /**
   * Get translation queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    const [queuedJobs, processingJobs] = await Promise.all([
      this.db.getQueuedTranslationJobs(1000),
      // Would need additional query for processing jobs
    ]);

    // Get daily completion stats
    const completionStats = await this.db.getTranslationQualityMetrics(1);
    
    return {
      queued: queuedJobs.length,
      processing: this.processingWorkers.size,
      completed_today: completionStats?.total_translations || 0,
      failed_today: 0, // Would need additional query
      avg_processing_time: 0, // Would need additional metrics
      avg_quality_score: completionStats?.avg_quality || 0
    };
  }

  /**
   * Bulk create translation jobs for urgent articles
   */
  async createBulkTranslationJobs(
    urgencyLevel: 'breaking' | 'high',
    targetLanguages: LanguageCode[],
    limit: number = 20
  ): Promise<string[]> {
    const articles = await this.db.getArticlesForTranslation(limit, urgencyLevel);
    const jobIds: string[] = [];

    for (const article of articles) {
      try {
        const priority: JobPriority = urgencyLevel === 'breaking' ? 'urgent' : 'high';
        const articleJobIds = await this.createTranslationJobs(
          article.id,
          targetLanguages,
          priority
        );
        jobIds.push(...articleJobIds);
      } catch (error) {
        console.error(`Failed to create translation job for article ${article.id}:`, error);
      }
    }

    return jobIds;
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private calculateEstimatedCompletion(
    article: ArticleOriginal,
    targetLanguages: LanguageCode[],
    priority: JobPriority
  ): string {
    const baseProcessingTime = 30; // seconds per language
    const priorityMultiplier = { urgent: 0.5, high: 0.7, normal: 1.0, low: 1.5 }[priority];
    
    const estimatedSeconds = targetLanguages.length * baseProcessingTime * priorityMultiplier;
    const estimatedCompletion = new Date(Date.now() + estimatedSeconds * 1000);
    
    return estimatedCompletion.toISOString();
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter(word => word.length > 0).length;
  }
}