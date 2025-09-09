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
  private readonly headers: Record<string, string> = {};

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
    } else if (this.config.provider === 'ollama') {
      this.baseUrl = this.config.baseUrl || 'http://127.0.0.1:11434';
      this.headers = {
        'Content-Type': 'application/json'
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
      } else if (this.config.provider === 'ollama') {
        return await this.translateWithOllama(request, startTime);
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
      } else if (this.config.provider === 'ollama') {
        return await this.summarizeWithOllama(request, startTime);
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

    if (this.config.provider === 'ollama') {
      return await this.detectLanguageWithOllama(text);
    }

    // Use LLM for language detection (OpenAI/Anthropic)
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

  private async translateWithOllama(request: TranslationRequest, startTime: number): Promise<TranslationResponse> {
    const languageNames = this.getLanguageNames();
    const sourceLang = languageNames[request.sourceLanguage];
    const targetLang = languageNames[request.targetLanguage];

    const prompt = `You are a professional translator. Translate the following ${sourceLang} text to ${targetLang}. 

Requirements:
- Maintain the original meaning and tone
- Keep proper nouns and technical terms accurate
- Preserve any formatting (if present)
- Return ONLY the translated text, no explanations or additional text

Text to translate:
${request.text}`;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const translatedText = data.response?.trim() || '';
    
    return {
      translatedText,
      qualityScore: this.calculateQualityScore(request.text, translatedText),
      confidence: 0.85, // Slightly lower than commercial APIs
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

  private async summarizeWithOllama(request: SummarizationRequest, startTime: number): Promise<SummarizationResponse> {
    const languageName = this.getLanguageNames()[request.language];
    
    const prompt = `You are an expert at creating concise, informative summaries. Create a summary of the following text in ${languageName}.

Requirements:
- Maximum length: ${request.maxLength} characters
- Style: ${request.style === 'bullet-points' ? 'Use bullet points to list key information' : 'Write in paragraph format'}
- Language: ${languageName}
- Focus on the most important information
- Return ONLY the summary, no explanations or additional text

Text to summarize:
${request.text}`;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: this.config.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: Math.ceil(request.maxLength / 2) // Rough token estimate
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const summary = data.response?.trim() || '';
    
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

  private async detectLanguageWithOllama(text: string): Promise<{ language: SupportedLanguage; confidence: number }> {
    const prompt = `You are a language detection expert. Analyze the following text and determine its language.

Respond with ONLY the ISO 639-1 language code from this list:
- en (English)
- es (Spanish)  
- pt (Portuguese)
- fr (French)
- ar (Arabic)
- zh (Chinese)
- ja (Japanese)

Text to analyze:
${text.slice(0, 500)}

Language code:`;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: this.config.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent detection
            num_predict: 5    // Short response expected
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const detected = data.response?.trim().toLowerCase() as SupportedLanguage;
      const supported: SupportedLanguage[] = ['en', 'es', 'pt', 'fr', 'ar', 'zh', 'ja'];
      
      return {
        language: supported.includes(detected) ? detected : this.simpleLanguageDetection(text),
        confidence: supported.includes(detected) ? 0.85 : 0.6
      };
    } catch (error) {
      // Fallback to simple detection
      return { language: this.simpleLanguageDetection(text), confidence: 0.5 };
    }
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

  /**
   * Categorize article content with enhanced taxonomy
   */
  async categorizeContent(text: string, title?: string, language?: SupportedLanguage) {
    const startTime = Date.now();
    const contentToAnalyze = title ? `Title: ${title}\n\nContent: ${text}` : text;
    const languageName = language ? this.getLanguageNames()[language] : 'English';
    
    const categories = ['finance', 'tech', 'politics', 'health', 'science', 'sports', 
      'entertainment', 'business', 'education', 'travel', 'lifestyle',
      'gaming', 'crypto', 'environment', 'opinion', 'breaking'];
    
    const prompt = `Analyze this ${languageName} article and classify it into categories from this list: ${categories.join(', ')}.

Provide:
1. Primary category (most relevant)
2. Secondary categories (up to 3, if applicable)  
3. Relevant tags (keywords/topics)

Text to classify:
${contentToAnalyze.slice(0, 2000)}

Format: PRIMARY_CATEGORY|CONFIDENCE|SECONDARY1:CONF1,SECONDARY2:CONF2|TAG1,TAG2,TAG3|REASONING`;

    // Mock response in development
    if (this.config.mockInDev) {
      return {
        primary_category: text.toLowerCase().includes('tech') || title?.toLowerCase().includes('tech') ? 'tech' : 'finance',
        confidence: 0.8,
        secondary_categories: [{ category: 'business', confidence: 0.6 }],
        tags: ['business', 'news', 'analysis'],
        model: 'mock-classifier',
        processing_time_ms: Date.now() - startTime,
        reasoning: '[MOCK] Simple keyword-based classification'
      };
    }

    try {
      const response = await this.callLLM({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim() || 'finance|0.5||business,news|Unable to classify';
      const parts = content.split('|');
      
      const primary_category = categories.includes(parts[0]?.toLowerCase()) ? parts[0]?.toLowerCase() : 'finance';
      const confidence = Math.max(0, Math.min(1, parseFloat(parts[1]) || 0.5));
      
      // Parse secondary categories
      const secondary_categories = parts[2] ? parts[2].split(',').map(sec => {
        const [cat, conf] = sec.split(':');
        return {
          category: categories.includes(cat?.toLowerCase()) ? cat.toLowerCase() : 'business',
          confidence: Math.max(0, Math.min(1, parseFloat(conf) || 0.3))
        };
      }).slice(0, 3) : [];
      
      const tags = parts[3] ? parts[3].split(',').map(tag => tag.trim()).filter(Boolean) : [];
      const reasoning = parts[4] || 'Classification based on content analysis';

      return {
        primary_category,
        confidence,
        secondary_categories,
        tags,
        model: this.config.model,
        processing_time_ms: Date.now() - startTime,
        reasoning
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'categorizeContent' });
      // Fallback to simple keyword classification
      const fullText = text + ' ' + (title || '');
      const isFinance = /\b(bank|invest|market|money|financial|economy|trading|stock)\b/i.test(fullText);
      const isTech = /\b(tech|software|AI|digital|computer|app|innovation|startup)\b/i.test(fullText);
      const isPolitics = /\b(government|election|policy|political|congress|senate)\b/i.test(fullText);
      
      return {
        primary_category: isTech ? 'tech' : isPolitics ? 'politics' : 'finance',
        confidence: 0.6,
        secondary_categories: [],
        tags: ['classification-fallback'],
        model: 'keyword-fallback',
        processing_time_ms: Date.now() - startTime,
        reasoning: 'Fallback keyword-based classification'
      };
    }
  }

  /**
   * Assess content quality
   */
  async assessContentQuality(
    text: string,
    title?: string,
    url?: string,
    language?: SupportedLanguage
  ): Promise<{
    overallScore: number;
    readabilityScore: number;
    informativenessScore: number;
    credibilityScore: number;
    engagementScore: number;
    assessmentDetails: {
      wordCount: number;
      sentenceCount: number;
      avgSentenceLength: number;
      hasProperStructure: boolean;
      containsFactualClaims: boolean;
      tone: 'neutral' | 'positive' | 'negative' | 'mixed';
      complexityLevel: 'basic' | 'intermediate' | 'advanced';
    };
    recommendations?: string[];
  }> {
    const startTime = Date.now();

    // Basic text analysis
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgSentenceLength = sentences > 0 ? words / sentences : 0;
    
    // Mock response in development
    if (this.config.mockInDev) {
      return {
        overallScore: 0.75,
        readabilityScore: 0.8,
        informativenessScore: 0.7,
        credibilityScore: 0.8,
        engagementScore: 0.7,
        assessmentDetails: {
          wordCount: words,
          sentenceCount: sentences,
          avgSentenceLength,
          hasProperStructure: true,
          containsFactualClaims: true,
          tone: 'neutral',
          complexityLevel: 'intermediate'
        },
        recommendations: ['[MOCK] Consider adding more specific examples', '[MOCK] Improve paragraph structure']
      };
    }

    const contentToAnalyze = title ? `Title: ${title}\n\nContent: ${text}` : text;
    const languageName = language ? this.getLanguageNames()[language] : 'English';
    
    const prompt = `Analyze this ${languageName} article for content quality. Assess these aspects (score each 0-1):

1. Readability: Clear, well-structured, easy to understand
2. Informativeness: Contains useful, specific information
3. Credibility: Appears factual, well-sourced, trustworthy
4. Engagement: Interesting, compelling, holds attention

Also determine:
- Tone: neutral/positive/negative/mixed
- Complexity: basic/intermediate/advanced
- Structure quality (true/false)
- Contains factual claims (true/false)

Text to analyze:
${contentToAnalyze.slice(0, 3000)}

Format your response as:
READABILITY|INFORMATIVENESS|CREDIBILITY|ENGAGEMENT|TONE|COMPLEXITY|STRUCTURE|FACTUAL|RECOMMENDATIONS`;

    try {
      const response = await this.callLLM({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim() || '0.5|0.5|0.5|0.5|neutral|intermediate|true|true|Improve content quality';
      const parts = content.split('|');
      
      const readabilityScore = Math.max(0, Math.min(1, parseFloat(parts[0]) || 0.5));
      const informativenessScore = Math.max(0, Math.min(1, parseFloat(parts[1]) || 0.5));
      const credibilityScore = Math.max(0, Math.min(1, parseFloat(parts[2]) || 0.5));
      const engagementScore = Math.max(0, Math.min(1, parseFloat(parts[3]) || 0.5));
      
      const tone = (['neutral', 'positive', 'negative', 'mixed'].includes(parts[4]) ? parts[4] : 'neutral') as 'neutral' | 'positive' | 'negative' | 'mixed';
      const complexityLevel = (['basic', 'intermediate', 'advanced'].includes(parts[5]) ? parts[5] : 'intermediate') as 'basic' | 'intermediate' | 'advanced';
      const hasProperStructure = parts[6]?.toLowerCase() === 'true';
      const containsFactualClaims = parts[7]?.toLowerCase() === 'true';
      
      const overallScore = (readabilityScore + informativenessScore + credibilityScore + engagementScore) / 4;
      
      const recommendations = parts[8] ? [parts[8]] : [];

      return {
        overallScore,
        readabilityScore,
        informativenessScore,
        credibilityScore,
        engagementScore,
        assessmentDetails: {
          wordCount: words,
          sentenceCount: sentences,
          avgSentenceLength,
          hasProperStructure,
          containsFactualClaims,
          tone,
          complexityLevel
        },
        recommendations: recommendations.length > 0 ? recommendations : undefined
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'assessContentQuality' });
      
      // Fallback to basic assessment
      const readabilityScore = avgSentenceLength > 15 && avgSentenceLength < 25 ? 0.8 : 0.6;
      const informativenessScore = words > 100 ? 0.7 : 0.5;
      const credibilityScore = 0.6; // Default neutral
      const engagementScore = title ? 0.7 : 0.6;
      
      return {
        overallScore: (readabilityScore + informativenessScore + credibilityScore + engagementScore) / 4,
        readabilityScore,
        informativenessScore,
        credibilityScore,
        engagementScore,
        assessmentDetails: {
          wordCount: words,
          sentenceCount: sentences,
          avgSentenceLength,
          hasProperStructure: sentences > 2,
          containsFactualClaims: true,
          tone: 'neutral',
          complexityLevel: words > 500 ? 'advanced' : words > 200 ? 'intermediate' : 'basic'
        }
      };
    }
  }

  /**
   * Analyze sentiment of content
   */
  async analyzeSentiment(text: string, title?: string, language?: SupportedLanguage) {
    const startTime = Date.now();
    const contentToAnalyze = title ? `Title: ${title}\n\nContent: ${text}` : text;
    const languageName = language ? this.getLanguageNames()[language] : 'English';
    
    // Mock response in development
    if (this.config.mockInDev) {
      const hasPositive = /\b(great|good|excellent|amazing|positive|success|win)\b/i.test(text + ' ' + (title || ''));
      const hasNegative = /\b(bad|terrible|failure|crisis|problem|decline)\b/i.test(text + ' ' + (title || ''));
      
      return {
        sentiment: hasPositive && !hasNegative ? 'positive' : hasNegative && !hasPositive ? 'negative' : 'neutral',
        confidence: 0.7,
        sentiment_scores: { positive: hasPositive ? 0.7 : 0.2, negative: hasNegative ? 0.7 : 0.2, neutral: 0.3 },
        emotional_indicators: hasPositive ? ['success', 'positive'] : hasNegative ? ['problem', 'crisis'] : ['neutral'],
        model: 'mock-sentiment',
        processing_time_ms: Date.now() - startTime
      };
    }

    const prompt = `Analyze the sentiment and emotional tone of this ${languageName} text.

Provide:
1. Overall sentiment: positive, negative, neutral, or mixed
2. Confidence score (0-1)
3. Individual sentiment scores (positive, negative, neutral - must sum to 1.0)
4. Key emotional indicators (words/phrases that indicate sentiment)

Text to analyze:
${contentToAnalyze.slice(0, 3000)}

Format: SENTIMENT|CONFIDENCE|POS_SCORE:NEG_SCORE:NEUTRAL_SCORE|INDICATOR1,INDICATOR2,INDICATOR3`;

    try {
      const response = await this.callLLM({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim() || 'neutral|0.5|0.2:0.2:0.6|neutral';
      const parts = content.split('|');
      
      const sentiment = ['positive', 'negative', 'neutral', 'mixed'].includes(parts[0]) ? parts[0] : 'neutral';
      const confidence = Math.max(0, Math.min(1, parseFloat(parts[1]) || 0.5));
      
      const scores = parts[2] ? parts[2].split(':').map(s => parseFloat(s) || 0) : [0.3, 0.3, 0.4];
      const sentiment_scores = {
        positive: Math.max(0, Math.min(1, scores[0] || 0.33)),
        negative: Math.max(0, Math.min(1, scores[1] || 0.33)),
        neutral: Math.max(0, Math.min(1, scores[2] || 0.34))
      };
      
      const emotional_indicators = parts[3] ? parts[3].split(',').map(ind => ind.trim()).filter(Boolean) : [];

      return {
        sentiment,
        confidence,
        sentiment_scores,
        emotional_indicators,
        model: this.config.model,
        processing_time_ms: Date.now() - startTime
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'analyzeSentiment' });
      
      return {
        sentiment: 'neutral',
        confidence: 0.5,
        sentiment_scores: { positive: 0.33, negative: 0.33, neutral: 0.34 },
        emotional_indicators: ['analysis-failed'],
        model: 'fallback',
        processing_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Detect bias in content
   */
  async detectBias(text: string, title?: string, language?: SupportedLanguage) {
    const startTime = Date.now();
    const contentToAnalyze = title ? `Title: ${title}\n\nContent: ${text}` : text;
    const languageName = language ? this.getLanguageNames()[language] : 'English';
    
    // Mock response in development
    if (this.config.mockInDev) {
      return {
        overall_bias_score: 0.3,
        bias_types: [
          { type: 'confirmation', severity: 'low', confidence: 0.6, indicators: ['selective facts'] }
        ],
        political_leaning: 'neutral',
        factual_vs_opinion_score: 0.7,
        language_tone: 'balanced',
        model: 'mock-bias-detector',
        processing_time_ms: Date.now() - startTime,
        recommendations: ['Consider multiple perspectives']
      };
    }

    const prompt = `Analyze this ${languageName} text for various types of bias and objectivity.

Assess:
1. Overall bias score (0=neutral, 1=highly biased)
2. Bias types: political, demographic, confirmation, selection, emotional, commercial
3. Political leaning if applicable: left, center-left, center, center-right, right, neutral
4. Factual vs opinion ratio (0=pure opinion, 1=factual)
5. Language tone: objective, subjective, inflammatory, sensational, balanced

Text to analyze:
${contentToAnalyze.slice(0, 4000)}

Format: OVERALL_SCORE|BIAS_TYPE1:SEVERITY1:CONFIDENCE1,TYPE2:SEVERITY2:CONFIDENCE2|POLITICAL|FACTUAL_SCORE|TONE|RECOMMENDATIONS`;

    try {
      const response = await this.callLLM({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim() || '0.3|confirmation:low:0.6|neutral|0.7|balanced|Consider multiple sources';
      const parts = content.split('|');
      
      const overall_bias_score = Math.max(0, Math.min(1, parseFloat(parts[0]) || 0.3));
      
      // Parse bias types
      const bias_types = parts[1] ? parts[1].split(',').map(bias => {
        const [type, severity, confidence] = bias.split(':');
        return {
          type: ['political', 'demographic', 'confirmation', 'selection', 'emotional', 'commercial'].includes(type) ? type : 'confirmation',
          severity: ['low', 'moderate', 'high'].includes(severity) ? severity : 'low',
          confidence: Math.max(0, Math.min(1, parseFloat(confidence) || 0.5)),
          indicators: [`${type} bias detected`]
        };
      }) : [];
      
      const political_leaning = ['left', 'center-left', 'center', 'center-right', 'right', 'neutral'].includes(parts[2]) ? parts[2] : 'neutral';
      const factual_vs_opinion_score = Math.max(0, Math.min(1, parseFloat(parts[3]) || 0.7));
      const language_tone = ['objective', 'subjective', 'inflammatory', 'sensational', 'balanced'].includes(parts[4]) ? parts[4] : 'balanced';
      const recommendations = parts[5] ? [parts[5]] : [];

      return {
        overall_bias_score,
        bias_types,
        political_leaning,
        factual_vs_opinion_score,
        language_tone,
        model: this.config.model,
        processing_time_ms: Date.now() - startTime,
        recommendations
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'detectBias' });
      
      return {
        overall_bias_score: 0.5,
        bias_types: [],
        political_leaning: 'neutral',
        factual_vs_opinion_score: 0.6,
        language_tone: 'balanced',
        model: 'fallback',
        processing_time_ms: Date.now() - startTime,
        recommendations: ['Analysis unavailable - manual review recommended']
      };
    }
  }

  /**
   * Extract topics, entities, and keywords
   */
  async extractTopics(text: string, title?: string, maxTopics: number = 10, language?: SupportedLanguage) {
    const startTime = Date.now();
    const contentToAnalyze = title ? `Title: ${title}\n\nContent: ${text}` : text;
    const languageName = language ? this.getLanguageNames()[language] : 'English';
    
    // Mock response in development
    if (this.config.mockInDev) {
      const words = text.split(' ').slice(0, 10);
      return {
        topics: words.slice(0, 5).map((word, i) => ({
          topic: word,
          relevance_score: 1 - (i * 0.1),
          category: 'business'
        })),
        entities: [
          { entity: 'Mock Company', type: 'organization', confidence: 0.8 }
        ],
        keywords: words.slice(0, 8).map((word, i) => ({
          keyword: word,
          importance: 1 - (i * 0.1)
        })),
        model: 'mock-topic-extractor',
        processing_time_ms: Date.now() - startTime
      };
    }

    const prompt = `Extract topics, entities, and keywords from this ${languageName} text.

Provide up to ${maxTopics} most relevant:
1. Topics with relevance scores (0-1) and categories
2. Named entities (person, organization, location, product, event, concept)
3. Important keywords with importance scores

Text to analyze:
${contentToAnalyze.slice(0, 4000)}

Format: 
TOPICS: topic1:score1:category1,topic2:score2:category2
ENTITIES: entity1:type1:confidence1,entity2:type2:confidence2
KEYWORDS: keyword1:importance1,keyword2:importance2`;

    try {
      const response = await this.callLLM({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      const lines = content.split('\n');
      
      const topicsLine = lines.find(l => l.startsWith('TOPICS:'))?.replace('TOPICS:', '').trim();
      const entitiesLine = lines.find(l => l.startsWith('ENTITIES:'))?.replace('ENTITIES:', '').trim();  
      const keywordsLine = lines.find(l => l.startsWith('KEYWORDS:'))?.replace('KEYWORDS:', '').trim();
      
      const topics = topicsLine ? topicsLine.split(',').map(topic => {
        const [name, score, category] = topic.split(':');
        return {
          topic: name?.trim() || 'unknown',
          relevance_score: Math.max(0, Math.min(1, parseFloat(score) || 0.5)),
          category: category?.trim() || 'business'
        };
      }) : [];
      
      const entities = entitiesLine ? entitiesLine.split(',').map(entity => {
        const [name, type, confidence] = entity.split(':');
        return {
          entity: name?.trim() || 'unknown',
          type: ['person', 'organization', 'location', 'product', 'event', 'concept'].includes(type) ? type : 'concept',
          confidence: Math.max(0, Math.min(1, parseFloat(confidence) || 0.5))
        };
      }) : [];
      
      const keywords = keywordsLine ? keywordsLine.split(',').map(keyword => {
        const [word, importance] = keyword.split(':');
        return {
          keyword: word?.trim() || 'unknown',
          importance: Math.max(0, Math.min(1, parseFloat(importance) || 0.5))
        };
      }) : [];

      return {
        topics: topics.slice(0, maxTopics),
        entities: entities.slice(0, 10),
        keywords: keywords.slice(0, 15),
        model: this.config.model,
        processing_time_ms: Date.now() - startTime
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'extractTopics' });
      
      // Simple fallback extraction
      const words = text.split(/\s+/).filter(word => word.length > 3).slice(0, 10);
      
      return {
        topics: words.slice(0, 5).map((word, i) => ({
          topic: word,
          relevance_score: 0.6 - (i * 0.1),
          category: 'business'
        })),
        entities: [],
        keywords: words.map((word, i) => ({
          keyword: word,
          importance: 0.7 - (i * 0.05)
        })),
        model: 'fallback-extractor',
        processing_time_ms: Date.now() - startTime
      };
    }
  }

  /**
   * Comprehensive content analysis combining all tools
   */
  async analyzeContent(
    text: string,
    title?: string,
    url?: string,
    language?: SupportedLanguage,
    analysisTypes: string[] = ['all']
  ) {
    const startTime = Date.now();
    const includeAll = analysisTypes.includes('all');
    
    const results: any = {
      overall_processing_time_ms: 0,
      analysis_timestamp: new Date().toISOString()
    };

    try {
      // Run analyses based on requested types
      const analysisPromises: Promise<any>[] = [];
      
      if (includeAll || analysisTypes.includes('summarization')) {
        analysisPromises.push(
          this.summarizeText({
            text,
            language: language || 'en',
            maxLength: 150,
            style: 'brief'
          }).then(result => ({ type: 'summary', result }))
        );
      }
      
      if (includeAll || analysisTypes.includes('sentiment')) {
        analysisPromises.push(
          this.analyzeSentiment(text, title, language)
            .then(result => ({ type: 'sentiment', result }))
        );
      }
      
      if (includeAll || analysisTypes.includes('bias')) {
        analysisPromises.push(
          this.detectBias(text, title, language)
            .then(result => ({ type: 'bias', result }))
        );
      }
      
      if (includeAll || analysisTypes.includes('quality')) {
        analysisPromises.push(
          this.assessContentQuality(text, title, url, language)
            .then(result => ({ type: 'quality', result }))
        );
      }
      
      if (includeAll || analysisTypes.includes('categorization')) {
        analysisPromises.push(
          this.categorizeContent(text, title, language)
            .then(result => ({ type: 'categorization', result }))
        );
      }
      
      if (includeAll || analysisTypes.includes('topics')) {
        analysisPromises.push(
          this.extractTopics(text, title, 10, language)
            .then(result => ({ type: 'topics', result }))
        );
      }

      const analysisResults = await Promise.all(analysisPromises);
      
      // Organize results by type
      for (const { type, result } of analysisResults) {
        results[type] = result;
      }
      
      results.overall_processing_time_ms = Date.now() - startTime;
      
      return results;
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'analyzeContent' });
      
      results.overall_processing_time_ms = Date.now() - startTime;
      results.error = 'Comprehensive analysis failed';
      
      return results;
    }
  }
}