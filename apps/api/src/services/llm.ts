import { z } from 'zod';
import { llmConfig, isDevelopment } from '../config/environment.js';
import { ErrorHandler, ExternalServiceError, TimeoutError } from '../utils/errors.js';

/**
 * LLM Service for Translation and Content Processing
 * Supports OpenAI, Anthropic, and mock providers
 * Adapted from archive with enhanced error handling
 */

export type SupportedLanguage = 'en' | 'es' | 'pt' | 'fr' | 'ar' | 'zh' | 'ja';

export interface TranslationRequest {
  text: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  contentType?: 'title' | 'description' | 'content' | 'summary';
  context?: string;
}

export interface TranslationResponse {
  translatedText: string;
  qualityScore: number; // 0-1
  confidence: number; // 0-1
  detectedLanguage?: SupportedLanguage;
  model: string;
  processingTimeMs: number;
}

export interface SummarizationRequest {
  text: string;
  language: SupportedLanguage;
  maxLength: number;
  style?: 'brief' | 'detailed' | 'bullet-points';
}

export interface SummarizationResponse {
  summary: string;
  keyPoints?: string[];
  model: string;
  processingTimeMs: number;
}

const TranslationResponseSchema = z.object({
  translatedText: z.string(),
  qualityScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  detectedLanguage: z.enum(['en', 'es', 'pt', 'fr', 'ar', 'zh', 'ja']).optional(),
  model: z.string(),
  processingTimeMs: z.number()
});

export class LLMService {
  private readonly config = llmConfig;
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor() {
    if (this.config.mockInDev) {
      this.baseUrl = 'mock://llm-service';
    } else if (this.config.provider === 'openai') {
      this.baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
      this.headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      };
    } else if (this.config.provider === 'anthropic') {
      this.baseUrl = this.config.baseUrl || 'https://api.anthropic.com/v1';
      this.headers = {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01'
      };
    } else {
      throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  /**
   * Translate text content
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();

    // Mock response in development without API key
    if (this.config.mockInDev) {
      return this.mockTranslation(request, startTime);
    }

    try {
      if (this.config.provider === 'openai') {
        return await this.translateWithOpenAI(request, startTime);
      } else if (this.config.provider === 'anthropic') {
        return await this.translateWithAnthropic(request, startTime);
      }
      
      throw new Error(`Provider ${this.config.provider} not implemented`);
    } catch (error) {
      ErrorHandler.handleExternalServiceError('LLM', error);
    }
  }

  /**
   * Summarize text content
   */
  async summarizeText(request: SummarizationRequest): Promise<SummarizationResponse> {
    const startTime = Date.now();

    // Mock response in development
    if (this.config.mockInDev) {
      return this.mockSummarization(request, startTime);
    }

    try {
      if (this.config.provider === 'openai') {
        return await this.summarizeWithOpenAI(request, startTime);
      } else if (this.config.provider === 'anthropic') {
        return await this.summarizeWithAnthropic(request, startTime);
      }
      
      throw new Error(`Provider ${this.config.provider} not implemented`);
    } catch (error) {
      ErrorHandler.handleExternalServiceError('LLM', error);
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{ language: SupportedLanguage; confidence: number }> {
    if (this.config.mockInDev) {
      // Simple heuristic for development
      const lang = this.simpleLanguageDetection(text);
      return { language: lang, confidence: 0.9 };
    }

    // Use LLM for language detection
    const prompt = `Detect the language of this text. Respond with only the ISO 639-1 code (en, es, pt, fr, ar, zh, ja):\n\n${text.slice(0, 500)}`;
    
    try {
      const response = await this.callLLM({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 10,
        temperature: 0
      });

      const detected = response.choices[0]?.message?.content?.trim().toLowerCase() as SupportedLanguage;
      const supported: SupportedLanguage[] = ['en', 'es', 'pt', 'fr', 'ar', 'zh', 'ja'];
      
      return {
        language: supported.includes(detected) ? detected : 'en',
        confidence: 0.9
      };
    } catch (error) {
      // Fallback to simple detection
      return { language: this.simpleLanguageDetection(text), confidence: 0.5 };
    }
  }

  /**
   * Batch translate multiple texts
   */
  async batchTranslate(requests: TranslationRequest[]): Promise<TranslationResponse[]> {
    const batchSize = 5; // Process in batches to avoid rate limits
    const results: TranslationResponse[] = [];

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchPromises = batch.map(request => this.translateText(request));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches
        if (i + batchSize < requests.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        ErrorHandler.logError(error as Error, { batchIndex: i, batchSize: batch.length });
        throw error;
      }
    }

    return results;
  }

  /**
   * Process article with LLM (summarization and optional translation)
   */
  async processArticle(
    title: string,
    description: string | null,
    content: string | null,
    targetLanguage: SupportedLanguage
  ): Promise<{ summary: string; translatedTitle?: string }> {
    // Combine available text for processing
    const fullText = [title, description, content]
      .filter(Boolean)
      .join('\n\n');

    if (!fullText.trim()) {
      return { summary: 'No content available for processing' };
    }

    try {
      // Generate summary
      const summaryResponse = await this.summarizeText({
        text: fullText,
        language: targetLanguage,
        maxLength: 150,
        style: 'brief'
      });

      // If target language is different from detected, translate title
      let translatedTitle: string | undefined;
      const detected = await this.detectLanguage(title);
      
      if (detected.language !== targetLanguage) {
        const translationResponse = await this.translateText({
          text: title,
          sourceLanguage: detected.language,
          targetLanguage,
          contentType: 'title'
        });
        translatedTitle = translationResponse.translatedText;
      }

      return {
        summary: summaryResponse.summary,
        translatedTitle
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { title, targetLanguage });
      return { 
        summary: `Summary not available: ${(error as Error).message}`,
        translatedTitle: targetLanguage !== 'en' ? title : undefined
      };
    }
  }

  private async translateWithOpenAI(request: TranslationRequest, startTime: number): Promise<TranslationResponse> {
    const languageNames = this.getLanguageNames();
    const sourceLang = languageNames[request.sourceLanguage];
    const targetLang = languageNames[request.targetLanguage];

    const systemPrompt = `You are a professional translator. Translate the following ${sourceLang} text to ${targetLang}. Maintain the original meaning, tone, and style. If it's a title, keep it concise. If it's content, preserve formatting.`;
    
    const prompt = request.context ? 
      `Context: ${request.context}\n\nText to translate: ${request.text}` : 
      request.text;

    const response = await this.callLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature
    });

    const translatedText = response.choices[0]?.message?.content?.trim() || '';
    
    return {
      translatedText,
      qualityScore: this.calculateQualityScore(request.text, translatedText),
      confidence: 0.9,
      model: this.config.model,
      processingTimeMs: Date.now() - startTime
    };
  }

  private async translateWithAnthropic(request: TranslationRequest, startTime: number): Promise<TranslationResponse> {
    const languageNames = this.getLanguageNames();
    const sourceLang = languageNames[request.sourceLanguage];
    const targetLang = languageNames[request.targetLanguage];

    const prompt = `Translate this ${sourceLang} text to ${targetLang}. Maintain meaning and tone:\n\n${request.text}`;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const translatedText = data.content[0]?.text?.trim() || '';
    
    return {
      translatedText,
      qualityScore: this.calculateQualityScore(request.text, translatedText),
      confidence: 0.9,
      model: this.config.model,
      processingTimeMs: Date.now() - startTime
    };
  }

  private async summarizeWithOpenAI(request: SummarizationRequest, startTime: number): Promise<SummarizationResponse> {
    const languageName = this.getLanguageNames()[request.language];
    const systemPrompt = `You are an expert at creating concise, informative summaries. Create a ${request.maxLength}-character summary in ${languageName}. ${request.style === 'bullet-points' ? 'Use bullet points.' : 'Use paragraph format.'}`;

    const response = await this.callLLM({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.text }
      ],
      max_tokens: Math.ceil(request.maxLength / 2), // Rough token estimate
      temperature: this.config.temperature
    });

    const summary = response.choices[0]?.message?.content?.trim() || '';
    
    return {
      summary,
      model: this.config.model,
      processingTimeMs: Date.now() - startTime
    };
  }

  private async summarizeWithAnthropic(request: SummarizationRequest, startTime: number): Promise<SummarizationResponse> {
    const languageName = this.getLanguageNames()[request.language];
    const prompt = `Summarize this text in ${languageName} using approximately ${request.maxLength} characters:\n\n${request.text}`;

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: Math.ceil(request.maxLength / 2),
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    const summary = data.content[0]?.text?.trim() || '';
    
    return {
      summary,
      model: this.config.model,
      processingTimeMs: Date.now() - startTime
    };
  }

  private async callLLM(payload: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: this.config.model,
          ...payload
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`LLM API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new TimeoutError('LLM request', 30000);
      }
      
      throw error;
    }
  }

  private mockTranslation(request: TranslationRequest, startTime: number): TranslationResponse {
    // Simple mock translation for development
    const mockText = `[TRANSLATED_${request.targetLanguage.toUpperCase()}] ${request.text}`;
    
    return {
      translatedText: mockText,
      qualityScore: 0.8,
      confidence: 0.9,
      model: 'mock-translator',
      processingTimeMs: Date.now() - startTime
    };
  }

  private mockSummarization(request: SummarizationRequest, startTime: number): SummarizationResponse {
    const words = request.text.split(' ');
    const summaryLength = Math.min(words.length, Math.ceil(request.maxLength / 6));
    const summary = `[SUMMARY] ${words.slice(0, summaryLength).join(' ')}...`;
    
    return {
      summary,
      model: 'mock-summarizer',
      processingTimeMs: Date.now() - startTime
    };
  }

  private simpleLanguageDetection(text: string): SupportedLanguage {
    const sample = text.toLowerCase().slice(0, 200);
    
    // Simple heuristic based on common words
    if (/\b(the|and|that|have|for|not|with|you|this|but|his|from|they)\b/.test(sample)) return 'en';
    if (/\b(el|la|de|que|y|es|en|un|se|no|te|lo|le|da|su|por|son|con|para|una|esta|muy)\b/.test(sample)) return 'es';
    if (/\b(de|que|não|uma|com|para|por|mais|como|mas|foi|ele|ela|seu|sua|isso)\b/.test(sample)) return 'pt';
    if (/\b(le|de|et|à|un|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas|tout|mais)\b/.test(sample)) return 'fr';
    if (/[\u4e00-\u9fff]/.test(sample)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(sample)) return 'ja';
    if (/[\u0600-\u06ff]/.test(sample)) return 'ar';
    
    return 'en'; // default fallback
  }

  private calculateQualityScore(original: string, translated: string): number {
    // Simple quality heuristic
    const lengthRatio = translated.length / original.length;
    const hasContent = translated.length > 0 && !translated.startsWith('[ERROR]');
    
    let score = 0.7; // base score
    
    if (!hasContent) return 0.1;
    if (lengthRatio > 0.3 && lengthRatio < 3.0) score += 0.2;
    if (translated !== original) score += 0.1; // actually translated
    
    return Math.min(score, 1.0);
  }

  private getLanguageNames(): Record<SupportedLanguage, string> {
    return {
      'en': 'English',
      'es': 'Spanish',
      'pt': 'Portuguese', 
      'fr': 'French',
      'ar': 'Arabic',
      'zh': 'Chinese',
      'ja': 'Japanese'
    };
  }

  /**
   * Health check for LLM service
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; responseTimeMs?: number }> {
    if (this.config.mockInDev) {
      return { status: 'healthy', responseTimeMs: 50 };
    }

    const startTime = Date.now();
    try {
      await this.translateText({
        text: 'Health check',
        sourceLanguage: 'en',
        targetLanguage: 'es'
      });
      
      return { 
        status: 'healthy', 
        responseTimeMs: Date.now() - startTime 
      };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  /**
   * Test LLM service connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
}