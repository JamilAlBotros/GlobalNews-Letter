import RSSParser from 'rss-parser';

export interface Article {
  id: string;
  title: string;
  link: string;
  description?: string;
  publishedAt: string;
  guid?: string;
}

export interface FeedMetadata {
  title?: string;
  description?: string;
  link?: string;
  lastUpdated?: string;
}

export interface FeedValidation {
  isValid: boolean;
  error?: string;
}

export class RSSProvider {
  private parser: RSSParser;

  constructor() {
    this.parser = new RSSParser({
      timeout: 10000,
      headers: {
        'User-Agent': 'GlobalNewsLetter/1.0 RSS Reader'
      }
    });
  }

  async validateFeedUrl(url: string): Promise<FeedValidation> {
    try {
      const feed = await this.parser.parseURL(url);
      
      if (!feed.items || feed.items.length === 0) {
        return {
          isValid: false,
          error: 'Feed contains no items'
        };
      }

      return {
        isValid: true
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async fetchFeed(url: string): Promise<{ articles: Article[]; metadata: FeedMetadata }> {
    try {
      const feed = await this.parser.parseURL(url);
      
      const articles: Article[] = (feed.items || []).map((item, index) => ({
        id: item.guid || `${url}-${index}-${Date.now()}`,
        title: item.title || 'No title',
        link: item.link || '',
        description: item.contentSnippet || item.content || '',
        publishedAt: item.pubDate || new Date().toISOString(),
        guid: item.guid
      }));

      const metadata: FeedMetadata = {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        lastUpdated: feed.lastBuildDate || new Date().toISOString()
      };

      return { articles, metadata };
    } catch (error) {
      throw new Error(`Failed to fetch RSS feed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async testFeedUrl(url: string): Promise<{
    isValid: boolean;
    error?: string;
    articleCount?: number;
    feedTitle?: string;
    sampleArticles?: Array<{
      title: string;
      link: string;
      publishedAt: string;
    }>;
  }> {
    try {
      const validation = await this.validateFeedUrl(url);
      
      if (!validation.isValid) {
        return {
          isValid: false,
          error: validation.error
        };
      }

      const { articles, metadata } = await this.fetchFeed(url);

      return {
        isValid: true,
        articleCount: articles.length,
        feedTitle: metadata.title || 'N/A',
        sampleArticles: articles.slice(0, 3).map(article => ({
          title: article.title,
          link: article.link,
          publishedAt: article.publishedAt
        }))
      };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}