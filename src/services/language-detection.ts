import { franc } from 'franc';
import type { RSSFeedMetadata, RSSArticle } from '../types/index.js';

/**
 * Language Detection Service using Franc library
 * Detects language from RSS feed content and maps to our supported languages
 */
export class LanguageDetectionService {
  private readonly supportedLanguages = ['english', 'spanish', 'arabic', 'portuguese', 'french', 'chinese', 'japanese'] as const;
  private readonly minTextLength = 50; // Minimum text length for reliable detection
  private readonly confidenceThreshold = 0.6; // Minimum confidence score

  /**
   * Detect language from RSS feed metadata and articles
   */
  async detectFeedLanguage(
    metadata: RSSFeedMetadata,
    articles: RSSArticle[]
  ): Promise<{
    detectedLanguage: string;
    confidence: number;
    method: 'metadata' | 'content' | 'fallback';
  }> {
    // 1. First try metadata language field
    const metadataLanguage = this.extractLanguageFromMetadata(metadata);
    if (metadataLanguage) {
      return {
        detectedLanguage: metadataLanguage,
        confidence: 0.9,
        method: 'metadata'
      };
    }

    // 2. Then try content-based detection
    const contentLanguage = this.detectLanguageFromContent(metadata, articles);
    if (contentLanguage) {
      return {
        detectedLanguage: contentLanguage.language,
        confidence: contentLanguage.confidence,
        method: 'content'
      };
    }

    // 3. Fallback to English
    return {
      detectedLanguage: 'english',
      confidence: 0.3,
      method: 'fallback'
    };
  }

  /**
   * Extract language from RSS metadata fields
   */
  private extractLanguageFromMetadata(metadata: RSSFeedMetadata): string | null {
    const language = metadata.language?.toLowerCase();
    if (!language) return null;

    // Map common language codes to our supported languages
    const languageMap: Record<string, string> = {
      'en': 'english',
      'en-us': 'english',
      'en-gb': 'english',
      'english': 'english',
      'es': 'spanish',
      'es-es': 'spanish',
      'es-mx': 'spanish',
      'spanish': 'spanish',
      'español': 'spanish',
      'ar': 'arabic',
      'ar-sa': 'arabic',
      'arabic': 'arabic',
      'عربي': 'arabic',
      'pt': 'portuguese',
      'pt-br': 'portuguese',
      'pt-pt': 'portuguese',
      'portuguese': 'portuguese',
      'português': 'portuguese',
      'fr': 'french',
      'fr-fr': 'french',
      'fr-ca': 'french',
      'french': 'french',
      'français': 'french',
      'zh': 'chinese',
      'zh-cn': 'chinese',
      'zh-tw': 'chinese',
      'zh-hk': 'chinese',
      'chinese': 'chinese',
      '中文': 'chinese',
      'ja': 'japanese',
      'ja-jp': 'japanese',
      'japanese': 'japanese',
      '日本語': 'japanese'
    };

    return languageMap[language] || null;
  }

  /**
   * Detect language from feed content using Franc
   */
  private detectLanguageFromContent(
    metadata: RSSFeedMetadata,
    articles: RSSArticle[]
  ): { language: string; confidence: number } | null {
    // Collect sample text from metadata and articles
    const textSamples: string[] = [];
    
    if (metadata.title) textSamples.push(metadata.title);
    if (metadata.description) textSamples.push(metadata.description);
    
    // Add text from first few articles
    articles.slice(0, 5).forEach(article => {
      if (article.title) textSamples.push(article.title);
      if (article.contentSnippet) textSamples.push(article.contentSnippet);
      if (article.content) {
        // Extract text from HTML content
        const textContent = this.extractTextFromHTML(article.content);
        if (textContent.length > this.minTextLength) {
          textSamples.push(textContent.slice(0, 500)); // Limit to 500 chars
        }
      }
    });

    const combinedText = textSamples.join(' ').trim();
    
    if (combinedText.length < this.minTextLength) {
      return null;
    }

    try {
      // First try URL-based detection for high-confidence domains
      const urlHint = this.detectLanguageFromUrl(metadata.link || '');
      if (urlHint) {
        return { language: urlHint, confidence: 0.85 };
      }

      // Then try keyword-based detection for better accuracy
      const keywordResult = this.detectLanguageFromKeywords(combinedText);
      if (keywordResult && keywordResult.confidence > 0.7) {
        return keywordResult;
      }

      // Then try Franc for statistical language detection
      const detectedCode = franc(combinedText, { minLength: this.minTextLength });
      
      if (detectedCode === 'und') {
        // If Franc fails, fall back to keyword result or URL hints
        const urlHint = this.detectLanguageFromUrl(metadata.link || '');
        if (urlHint) {
          return { language: urlHint, confidence: 0.8 }; // Higher confidence for URL detection
        }
        return keywordResult; // Might be null, that's ok
      }

      // Map Franc language codes to our supported languages
      const francToSupported = this.mapFrancCodeToSupported(detectedCode);
      if (!francToSupported) {
        // If Franc detected unsupported language, try keyword result
        return keywordResult;
      }

      // Calculate confidence based on text length and detection certainty
      const confidence = this.calculateConfidence(combinedText.length, detectedCode);
      
      if (confidence < this.confidenceThreshold) {
        return keywordResult; // Fall back to keyword detection
      }

      return {
        language: francToSupported,
        confidence
      };

    } catch (error) {
      console.error('Language detection error:', error);
      // Try keyword detection as fallback
      return this.detectLanguageFromKeywords(combinedText);
    }
  }

  /**
   * Detect language using keyword analysis
   */
  private detectLanguageFromKeywords(text: string): { language: string; confidence: number } | null {
    // Don't lowercase for Asian languages as it can break Unicode characters
    const normalizedText = text;
    
    const languageKeywords = {
      french: ['nouvelles', 'économie', 'marché', 'entreprise', 'technologie', 'depuis', 'après', 'selon', 'aussi', 'pour', 'avec', 'dans', 'sont', 'cette', 'leurs', 'mais', 'tout', 'plus', 'france', 'français', 'euros', 'paris'],
      spanish: ['noticias', 'economía', 'mercado', 'inversión', 'tecnología', 'empresa', 'dinero', 'años', 'desde', 'después', 'según', 'también', 'pero', 'todo', 'más', 'españa', 'español', 'madrid'],
      arabic: ['الأخبار', 'الاقتصاد', 'السوق', 'الاستثمار', 'التكنولوجيا', 'الشركة', 'اليوم', 'الذي', 'التي', 'هذا', 'هذه', 'كما', 'أن', 'في', 'من', 'إلى'],
      portuguese: ['notícias', 'economia', 'mercado', 'investimento', 'tecnologia', 'empresa', 'dinheiro', 'anos', 'desde', 'depois', 'segundo', 'também', 'mas', 'tudo', 'mais', 'brasil', 'português'],
      chinese: ['新闻', '经济', '市场', '投资', '技术', '公司', '企业', '年', '今天', '中国', '北京', '上海', '发展', '服务', '产品', '政府', '社会', '国家', '世界', '时间', '工作', '问题', '系统', '管理'],
      japanese: ['ニュース', '経済', '市場', '投資', '技術', '会社', '企業', '年', '今日', '日本', '東京', '大阪', '発展', 'サービス', '製品', '政府', '社会', '国家', '世界', '時間', '仕事', '問題', 'システム', '管理'],
      english: ['news', 'economy', 'market', 'investment', 'technology', 'company', 'business', 'years', 'since', 'after', 'according', 'also', 'but', 'all', 'more', 'united', 'states', 'english']
    };

    const scores = Object.entries(languageKeywords).map(([lang, keywords]) => {
      const matches = keywords.reduce((acc, word) => {
        let regex;
        let searchText = normalizedText;
        
        // For Chinese and Japanese, don't use word boundaries and don't case-normalize
        if (lang === 'chinese' || lang === 'japanese') {
          regex = new RegExp(word, 'g');
        } else {
          // For other languages, use case-insensitive search with word boundaries
          searchText = normalizedText.toLowerCase();
          word = word.toLowerCase();
          regex = new RegExp(`\\b${word}\\b`, 'g');
        }
        const matchCount = (searchText.match(regex) || []).length;
        return acc + matchCount;
      }, 0);
      
      return { 
        language: lang, 
        score: matches,
        confidence: Math.min(matches / 10, 0.95) // Scale score to confidence
      };
    }).sort((a, b) => b.score - a.score);

    if (scores[0].score > 0) {
      return {
        language: scores[0].language,
        confidence: scores[0].confidence
      };
    }

    return null;
  }

  /**
   * Detect language from URL/domain hints
   */
  private detectLanguageFromUrl(url: string): string | null {
    if (!url) return null;
    
    const urlLower = url.toLowerCase();
    
    // Domain-based language detection
    const domainHints: Record<string, string> = {
      '.fr': 'french',
      'lemonde.fr': 'french',
      'lefigaro.fr': 'french',
      'liberation.fr': 'french',
      'france24.com': 'french',
      '.es': 'spanish',
      'elpais.com': 'spanish',
      'elmundo.es': 'spanish',
      'clarin.com': 'spanish',
      '.ar': 'spanish',
      'alarabiya.net': 'arabic',
      'aljazeera.com': 'english', // Al Jazeera English
      'aljazeera.net': 'arabic',
      '.br': 'portuguese',
      'globo.com': 'portuguese',
      'folha.uol.com.br': 'portuguese',
      'b3.com.br': 'portuguese',
      '.cn': 'chinese',
      'sina.com.cn': 'chinese',
      'sohu.com': 'chinese',
      'qq.com': 'chinese',
      '163.com': 'chinese',
      'xinhuanet.com': 'chinese',
      'people.com.cn': 'chinese',
      'chinadaily.com.cn': 'chinese',
      'scmp.com': 'chinese', // South China Morning Post
      '.tw': 'chinese',
      '.hk': 'chinese',
      '.jp': 'japanese',
      'asahi.com': 'japanese',
      'nikkei.com': 'japanese',
      'mainichi.jp': 'japanese',
      'yomiuri.co.jp': 'japanese',
      'nhk.or.jp': 'japanese',
      'kyodo.co.jp': 'japanese',
      'japantimes.co.jp': 'english' // Japan Times is in English
    };

    for (const [hint, language] of Object.entries(domainHints)) {
      if (urlLower.includes(hint)) {
        return language;
      }
    }

    return null;
  }

  /**
   * Map Franc language codes to our supported languages
   */
  private mapFrancCodeToSupported(francCode: string): string | null {
    const codeMap: Record<string, string> = {
      // English
      'eng': 'english',
      
      // Spanish
      'spa': 'spanish',
      
      // Arabic
      'arb': 'arabic',
      'ara': 'arabic',
      
      // Portuguese
      'por': 'portuguese',
      
      // French
      'fra': 'french',
      'fre': 'french',
      
      // Chinese
      'cmn': 'chinese', // Mandarin Chinese
      'zho': 'chinese', // Chinese (generic)
      
      // Japanese
      'jpn': 'japanese'
    };

    return codeMap[francCode] || null;
  }

  /**
   * Calculate confidence score based on text length and detection
   */
  private calculateConfidence(textLength: number, detectedCode: string): number {
    // Base confidence
    let confidence = 0.7;

    // Adjust based on text length (more text = higher confidence)
    if (textLength > 1000) {
      confidence += 0.2;
    } else if (textLength > 500) {
      confidence += 0.1;
    }

    // Adjust based on detected language reliability
    const reliableLanguages = ['eng', 'spa', 'arb', 'ara', 'por'];
    if (reliableLanguages.includes(detectedCode)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95); // Cap at 95%
  }

  /**
   * Extract text content from HTML
   */
  private extractTextFromHTML(html: string): string {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
      .replace(/<[^>]*>/g, ' ') // Remove HTML tags
      .replace(/&[^;]+;/g, ' ') // Remove HTML entities
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Validate if detected language is supported
   */
  private isSupportedLanguage(language: string): boolean {
    return this.supportedLanguages.includes(language as any);
  }

  /**
   * Get confidence level description
   */
  getConfidenceLevel(confidence: number): string {
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Get supported languages list
   */
  getSupportedLanguages(): readonly string[] {
    return this.supportedLanguages;
  }
}