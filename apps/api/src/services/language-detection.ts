import { franc } from 'franc';

/**
 * Language Detection Service for RSS articles
 * Detects language from article content and maps to supported languages
 */
export class LanguageDetectionService {
  private readonly supportedLanguages = ['english', 'spanish', 'arabic', 'portuguese', 'french', 'chinese', 'japanese'] as const;
  private readonly minTextLength = 50;
  private readonly confidenceThreshold = 0.6;

  /**
   * Detect language from article content
   */
  detectArticleLanguage(article: {
    title: string;
    description?: string | null;
    content?: string | null;
    url: string;
  }): {
    detectedLanguage: string | null;
    needsManualReview: boolean;
    confidence: number;
    method: 'url' | 'content' | 'insufficient_content';
  } {
    // 1. First try URL-based detection for high-confidence domains
    const urlLanguage = this.detectLanguageFromUrl(article.url);
    if (urlLanguage) {
      return {
        detectedLanguage: urlLanguage,
        needsManualReview: false,
        confidence: 0.85,
        method: 'url'
      };
    }

    // 2. Check if we have sufficient content for reliable detection
    const textSamples: string[] = [];
    if (article.title) textSamples.push(article.title);
    if (article.description) textSamples.push(article.description);
    if (article.content) {
      const textContent = this.extractTextFromHTML(article.content);
      if (textContent.length > this.minTextLength) {
        textSamples.push(textContent.slice(0, 500));
      }
    }
    const combinedText = textSamples.join(' ').trim();
    
    // If insufficient content, flag for manual review
    if (combinedText.length < this.minTextLength) {
      return {
        detectedLanguage: null,
        needsManualReview: true,
        confidence: 0,
        method: 'insufficient_content'
      };
    }

    // 3. Then try content-based detection
    const contentLanguage = this.detectLanguageFromContent(article);
    if (contentLanguage) {
      return {
        detectedLanguage: contentLanguage.language,
        needsManualReview: false,
        confidence: contentLanguage.confidence,
        method: 'content'
      };
    }

    // 4. If we reach here, flag for manual review
    return {
      detectedLanguage: null,
      needsManualReview: true,
      confidence: 0,
      method: 'insufficient_content'
    };
  }

  /**
   * Detect language from article content
   */
  private detectLanguageFromContent(article: {
    title: string;
    description?: string | null;
    content?: string | null;
  }): { language: string; confidence: number } | null {
    const textSamples: string[] = [];
    
    if (article.title) textSamples.push(article.title);
    if (article.description) textSamples.push(article.description);
    if (article.content) {
      const textContent = this.extractTextFromHTML(article.content);
      if (textContent.length > this.minTextLength) {
        textSamples.push(textContent.slice(0, 500));
      }
    }

    const combinedText = textSamples.join(' ').trim();
    
    if (combinedText.length < this.minTextLength) {
      return null;
    }

    try {
      // Try keyword-based detection first for better accuracy
      const keywordResult = this.detectLanguageFromKeywords(combinedText);
      if (keywordResult && keywordResult.confidence > 0.7) {
        return keywordResult;
      }

      // Then try Franc for statistical language detection
      const detectedCode = franc(combinedText, { minLength: this.minTextLength });
      
      if (detectedCode === 'und') {
        return keywordResult || null;
      }

      // Map Franc language codes to our supported languages
      const francToSupported = this.mapFrancCodeToSupported(detectedCode);
      if (!francToSupported) {
        return keywordResult || null;
      }

      const confidence = this.calculateConfidence(combinedText.length, detectedCode);
      
      if (confidence < this.confidenceThreshold) {
        return keywordResult || null;
      }

      return {
        language: francToSupported,
        confidence
      };

    } catch (error) {
      console.error('Language detection error:', error);
      return this.detectLanguageFromKeywords(combinedText);
    }
  }

  /**
   * Detect language using keyword analysis
   */
  private detectLanguageFromKeywords(text: string): { language: string; confidence: number } | null {
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
        
        if (lang === 'chinese' || lang === 'japanese') {
          regex = new RegExp(word, 'g');
        } else {
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
        confidence: Math.min(matches / 10, 0.95)
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
      'aljazeera.com': 'english',
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
      'scmp.com': 'chinese',
      '.tw': 'chinese',
      '.hk': 'chinese',
      '.jp': 'japanese',
      'asahi.com': 'japanese',
      'nikkei.com': 'japanese',
      'mainichi.jp': 'japanese',
      'yomiuri.co.jp': 'japanese',
      'nhk.or.jp': 'japanese',
      'kyodo.co.jp': 'japanese',
      'japantimes.co.jp': 'english'
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
      'eng': 'english',
      'spa': 'spanish',
      'arb': 'arabic',
      'ara': 'arabic',
      'por': 'portuguese',
      'fra': 'french',
      'fre': 'french',
      'cmn': 'chinese',
      'zho': 'chinese',
      'jpn': 'japanese'
    };

    return codeMap[francCode] || null;
  }

  /**
   * Calculate confidence score based on text length and detection
   */
  private calculateConfidence(textLength: number, detectedCode: string): number {
    let confidence = 0.7;

    if (textLength > 1000) {
      confidence += 0.2;
    } else if (textLength > 500) {
      confidence += 0.1;
    }

    const reliableLanguages = ['eng', 'spa', 'arb', 'ara', 'por'];
    if (reliableLanguages.includes(detectedCode)) {
      confidence += 0.1;
    }

    return Math.min(confidence, 0.95);
  }

  /**
   * Extract text content from HTML
   */
  private extractTextFromHTML(html: string): string {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&[^;]+;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get supported languages list
   */
  getSupportedLanguages(): readonly string[] {
    return this.supportedLanguages;
  }
}