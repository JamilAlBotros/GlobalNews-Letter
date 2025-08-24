import { z } from 'zod';
import type { LLMRequest, LLMResponse, Language } from '../types/index.js';
import { appConfig } from '../config/index.js';

/**
 * Local LLM service integration (Ollama placeholder)
 * This service provides AI summarization and translation capabilities
 */
export class LLMService {
  private readonly apiUrl: string;
  private readonly model: string;

  constructor() {
    this.apiUrl = appConfig.LLM_API_URL;
    this.model = appConfig.LLM_MODEL;
  }

  /**
   * Summarize article content using local LLM
   */
  async summarizeArticle(
    content: string, 
    maxLength: number = 150,
    language: Language = 'english'
  ): Promise<string> {
    const request: LLMRequest = {
      content,
      action: 'summarize',
      maxLength,
      targetLanguage: language
    };

    const response = await this.callLLM(request);
    return response.result;
  }

  /**
   * Translate content to target language
   */
  async translateContent(
    content: string, 
    targetLanguage: Language
  ): Promise<string> {
    const request: LLMRequest = {
      content,
      action: 'translate',
      targetLanguage
    };

    const response = await this.callLLM(request);
    return response.result;
  }

  /**
   * Generate summary and translate if needed
   */
  async processArticle(
    title: string,
    description: string | null,
    content: string | null,
    targetLanguage: Language = 'english'
  ): Promise<{ summary: string; translatedTitle?: string }> {
    // Combine available text content
    const textContent = [title, description, content]
      .filter(Boolean)
      .join('\n\n');

    if (!textContent.trim()) {
      return { summary: 'No content available for summarization.' };
    }

    try {
      // Generate summary
      const summary = await this.summarizeArticle(textContent, 150, targetLanguage);
      
      // Translate title if target language is not English
      let translatedTitle: string | undefined;
      if (targetLanguage !== 'english') {
        translatedTitle = await this.translateContent(title, targetLanguage);
      }

      return { summary, translatedTitle };
    } catch (error) {
      console.warn('LLM processing failed, using fallback:', error);
      return this.getFallbackSummary(title, description, targetLanguage);
    }
  }

  /**
   * Test LLM service connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Call local LLM API (Ollama format)
   */
  private async callLLM(request: LLMRequest): Promise<LLMResponse> {
    const prompt = this.buildPrompt(request);
    
    try {
      const response = await fetch(`${this.apiUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
            max_tokens: request.maxLength || 150
          }
        })
      });

      if (!response.ok) {
        throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        result: data.response?.trim() || 'No response generated',
        usage: {
          inputTokens: data.prompt_eval_count || 0,
          outputTokens: data.eval_count || 0
        }
      };
    } catch (error) {
      throw new Error(`LLM service error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build prompt based on request type
   */
  private buildPrompt(request: LLMRequest): string {
    const { action, content, targetLanguage, maxLength } = request;

    if (action === 'summarize') {
      const languageInstruction = targetLanguage !== 'english' 
        ? ` in ${targetLanguage}` 
        : '';
      
      return `Summarize the following news article content in approximately ${maxLength} characters${languageInstruction}. Focus on the key facts and main points:\n\n${content}\n\nSummary:`;
    }

    if (action === 'translate') {
      const targetLang = targetLanguage === 'spanish' ? 'Spanish' : 
                        targetLanguage === 'arabic' ? 'Arabic' : 'English';
      
      return `Translate the following text to ${targetLang}. Maintain the original meaning and tone:\n\n${content}\n\nTranslation:`;
    }

    throw new Error(`Unsupported LLM action: ${action}`);
  }

  /**
   * Fallback summary when LLM is not available
   */
  private getFallbackSummary(
    title: string, 
    description: string | null, 
    targetLanguage: Language
  ): { summary: string; translatedTitle?: string } {
    const fallbackText = description || title;
    const truncated = fallbackText.length > 150 
      ? fallbackText.substring(0, 147) + '...' 
      : fallbackText;

    const result: { summary: string; translatedTitle?: string } = {
      summary: `[Fallback Summary] ${truncated}`
    };

    // Simple fallback for non-English languages
    if (targetLanguage !== 'english') {
      result.translatedTitle = `[Translation Unavailable] ${title}`;
    }

    return result;
  }
}