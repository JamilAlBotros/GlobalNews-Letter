import Parser from 'rss-parser';
import type { 
  RSSArticle, 
  RSSFeedMetadata,
  Category,
  Language 
} from '../types/index.js';

/**
 * RSS Feed provider for fetching articles from RSS feeds
 */
export class RSSProvider {
  private parser: Parser;

  constructor() {
    this.parser = new Parser({
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.1',
        'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8,ar;q=0.7,es;q=0.6',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Content-Type': 'application/xml'
      },
      customFields: {
        feed: ['language', 'lang'],
        item: ['language', 'lang']
      }
    });
  }

  /**
   * Fetch and parse RSS feed with retry logic
   */
  async fetchFeed(feedUrl: string): Promise<{
    articles: RSSArticle[];
    metadata: RSSFeedMetadata;
  }> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add random delay between retries
        if (attempt > 1) {
          const delay = Math.random() * 2000 + 1000; // 1-3 seconds
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Fetch raw content first to handle encoding and BOM issues
        const response = await fetch(feedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml, */*;q=0.1',
            'Accept-Language': 'en-US,en;q=0.9,pt;q=0.8,ar;q=0.7,es;q=0.6',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Check content type
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('xml') && !contentType.includes('rss') && !contentType.includes('atom')) {
          console.warn(`Unexpected content-type: ${contentType}, proceeding anyway...`);
        }

        let xmlContent = await response.text();
        
        // Strip BOM if present
        if (xmlContent.charCodeAt(0) === 0xFEFF) {
          xmlContent = xmlContent.slice(1);
        }
        
        // Remove leading/trailing whitespace and any non-XML content before <?xml
        xmlContent = xmlContent.trim();
        const xmlStart = xmlContent.indexOf('<?xml');
        if (xmlStart > 0) {
          xmlContent = xmlContent.substring(xmlStart);
        }
        
        // If no <?xml declaration, look for <rss or <feed
        if (!xmlContent.startsWith('<?xml')) {
          const rssStart = Math.max(xmlContent.indexOf('<rss'), xmlContent.indexOf('<feed'));
          if (rssStart > 0) {
            xmlContent = xmlContent.substring(rssStart);
          }
        }

        const feed = await this.parser.parseString(xmlContent);
        
        const articles: RSSArticle[] = feed.items.map(item => ({
          title: item.title || 'Untitled',
          link: item.link || '',
          pubDate: item.pubDate || item.isoDate,
          author: item.author || item.creator,
          content: item.content || item['content:encoded'],
          contentSnippet: item.contentSnippet,
          guid: item.guid,
          categories: item.categories || [],
          enclosure: item.enclosure ? {
            url: item.enclosure.url,
            type: item.enclosure.type || 'unknown',
          } : undefined,
        }));

        const metadata: RSSFeedMetadata = {
          title: feed.title,
          description: feed.description,
          link: feed.link,
          language: feed.language,
          lastBuildDate: feed.lastBuildDate,
          generator: feed.generator,
        };

        return { articles, metadata };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          // On final attempt, provide more detailed error info
          const errorMessage = lastError.message;
          if (errorMessage.includes('403')) {
            throw new Error(`Access denied (403). The RSS feed may block automated requests or require authentication: ${feedUrl}`);
          } else if (errorMessage.includes('404')) {
            throw new Error(`Feed not found (404). Please check the URL: ${feedUrl}`);
          } else if (errorMessage.includes('timeout')) {
            throw new Error(`Request timeout. The feed may be slow or unreachable: ${feedUrl}`);
          } else {
            throw new Error(`Failed to fetch RSS feed after ${maxRetries} attempts: ${errorMessage}`);
          }
        }
        
        console.warn(`Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Validate RSS feed URL
   */
  async validateFeedUrl(feedUrl: string): Promise<{ 
    isValid: boolean; 
    error?: string; 
    metadata?: RSSFeedMetadata; 
  }> {
    try {
      const { metadata } = await this.fetchFeed(feedUrl);
      return { isValid: true, metadata };
    } catch (error) {
      return { 
        isValid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Convert RSS article to our internal article format
   */
  convertRSSArticleToArticle(
    rssArticle: RSSArticle,
    feedId: string,
    feedName: string,
    category: Category,
    language: Language
  ) {
    const publishedAt = rssArticle.pubDate 
      ? new Date(rssArticle.pubDate) 
      : new Date();

    return {
      id: this.generateArticleId(rssArticle.link, feedId),
      title: rssArticle.title,
      author: rssArticle.author,
      description: rssArticle.contentSnippet || this.extractDescriptionFromContent(rssArticle.content),
      url: rssArticle.link,
      imageUrl: rssArticle.enclosure?.url,
      publishedAt,
      content: rssArticle.content,
      category,
      source: feedName,
      summary: null, // Will be generated by LLM service
      language,
      originalLanguage: language,
      isSelected: false,
      createdAt: new Date(),
    };
  }

  /**
   * Extract description from HTML content
   */
  private extractDescriptionFromContent(content?: string): string | null {
    if (!content) return null;
    
    // Simple HTML tag removal and truncation
    const textContent = content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Return first 200 characters
    return textContent.length > 200 
      ? textContent.substring(0, 197) + '...'
      : textContent;
  }

  /**
   * Generate unique article ID from URL and feed ID
   */
  private generateArticleId(articleUrl: string, feedId: string): string {
    // Create a simple hash-like ID from URL and feed ID
    const input = `${feedId}-${articleUrl}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `rss-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Detect category from RSS feed content
   */
  detectCategoryFromFeed(
    metadata: RSSFeedMetadata, 
    articles: RSSArticle[]
  ): Category {
    const text = [
      metadata.title,
      metadata.description,
      ...articles.slice(0, 5).map(a => a.title + ' ' + a.contentSnippet)
    ].join(' ').toLowerCase();

    const financeKeywords = [
      'finance', 'money', 'bank', 'investment', 'stock', 'crypto', 
      'economy', 'market', 'trading', 'fintech', 'business'
    ];
    
    const techKeywords = [
      'technology', 'tech', 'software', 'ai', 'startup', 'programming', 
      'computer', 'digital', 'innovation', 'cybersecurity', 'data'
    ];

    const financeScore = financeKeywords.reduce((score, keyword) => 
      score + (text.includes(keyword) ? 1 : 0), 0);
    
    const techScore = techKeywords.reduce((score, keyword) => 
      score + (text.includes(keyword) ? 1 : 0), 0);

    return financeScore > techScore ? 'finance' : 'tech';
  }

  /**
   * Detect language from RSS feed content
   */
  detectLanguageFromFeed(
    metadata: RSSFeedMetadata, 
    articles: RSSArticle[]
  ): Language {
    // Check metadata language first
    if (metadata.language) {
      const lang = metadata.language.toLowerCase();
      
      // Spanish detection
      if (lang.includes('es') || lang.includes('spanish') || lang.includes('español')) {
        return 'spanish';
      }
      
      // Arabic detection
      if (lang.includes('ar') || lang.includes('arabic') || lang.includes('عربي')) {
        return 'arabic';
      }
      
      // Portuguese detection
      if (lang.includes('pt') || lang.includes('portuguese') || lang.includes('português')) {
        return 'english'; // Treat Portuguese as English for now
      }
      
      // English detection (default for en, en-US, etc.)
      if (lang.includes('en') || lang.includes('english')) {
        return 'english';
      }
    }

    // Content-based language detection
    const sampleText = [
      metadata.title || '',
      metadata.description || '',
      ...articles.slice(0, 3).map(a => (a.title || '') + ' ' + (a.contentSnippet || ''))
    ].join(' ').toLowerCase();

    // Spanish keywords
    const spanishKeywords = ['noticias', 'economía', 'mercado', 'inversión', 'tecnología', 'empresa', 'dinero'];
    const spanishCount = spanishKeywords.reduce((count, word) => count + (sampleText.includes(word) ? 1 : 0), 0);

    // Arabic keywords (common Arabic words)
    const arabicKeywords = ['الأخبار', 'الاقتصاد', 'السوق', 'الاستثمار', 'التكنولوجيا', 'الشركة'];
    const arabicCount = arabicKeywords.reduce((count, word) => count + (sampleText.includes(word) ? 1 : 0), 0);

    // Portuguese keywords
    const portugueseKeywords = ['notícias', 'economia', 'mercado', 'investimento', 'tecnologia', 'empresa', 'dinheiro'];
    const portugueseCount = portugueseKeywords.reduce((count, word) => count + (sampleText.includes(word) ? 1 : 0), 0);

    // Return language with highest keyword match
    if (arabicCount > 0) return 'arabic';
    if (spanishCount > portugueseCount && spanishCount > 0) return 'spanish';
    
    // Default to English (includes Portuguese for now)
    return 'english';
  }

  /**
   * Get common RSS feed URLs for different categories
   */
  static getCommonRSSFeeds(): Record<Category, Array<{ name: string; url: string; description: string }>> {
    return {
      finance: [
        {
          name: 'Reuters Business',
          url: 'https://feeds.reuters.com/reuters/businessNews',
          description: 'Reuters business and financial news'
        },
        {
          name: 'Bloomberg',
          url: 'https://feeds.bloomberg.com/markets/news.rss',
          description: 'Bloomberg markets and financial news'
        },
        {
          name: 'Financial Times',
          url: 'https://www.ft.com/rss/home',
          description: 'Financial Times global business news'
        },
        {
          name: 'MarketWatch',
          url: 'https://feeds.marketwatch.com/marketwatch/marketpulse/',
          description: 'MarketWatch financial and investing news'
        }
      ],
      tech: [
        {
          name: 'TechCrunch',
          url: 'https://techcrunch.com/feed/',
          description: 'TechCrunch startup and technology news'
        },
        {
          name: 'Ars Technica',
          url: 'https://feeds.arstechnica.com/arstechnica/index',
          description: 'Ars Technica technology and science news'
        },
        {
          name: 'The Verge',
          url: 'https://www.theverge.com/rss/index.xml',
          description: 'The Verge technology and culture news'
        },
        {
          name: 'Wired',
          url: 'https://www.wired.com/feed/rss',
          description: 'Wired technology, business, and culture'
        },
        {
          name: 'Hacker News',
          url: 'https://hnrss.org/frontpage',
          description: 'Hacker News top stories'
        }
      ]
    };
  }
}