import { writeFile } from 'fs/promises';
import { join } from 'path';
import type { 
  Newsletter, 
  NewsletterArticle, 
  Article, 
  Language 
} from '../types/index.js';
import { appConfig } from '../config/index.js';

/**
 * Newsletter generation service
 */
export class NewsletterService {
  constructor() {}

  /**
   * Generate newsletter from selected articles
   */
  async generateNewsletter(
    articles: Article[], 
    language: Language = 'english'
  ): Promise<Newsletter> {
    console.log(`Generating newsletter with ${articles.length} articles in ${language}`);

    const newsletterArticles: NewsletterArticle[] = articles.map(article => ({
      title: article.title,
      author: article.author,
      link: article.url,
      summary: article.summary || article.description || 'No summary available'
    }));

    const newsletter: Newsletter = {
      generatedAt: new Date(),
      language,
      articles: newsletterArticles
    };

    return newsletter;
  }

  /**
   * Save newsletter as JSON file
   */
  async saveNewsletterAsJSON(
    newsletter: Newsletter, 
    filename?: string
  ): Promise<string> {
    const timestamp = newsletter.generatedAt.toISOString().split('T')[0];
    const defaultFilename = `newsletter-${newsletter.language}-${timestamp}.json`;
    const outputFilename = filename || defaultFilename;
    const outputPath = join(appConfig.OUTPUT_DIR, outputFilename);

    const formattedNewsletter = {
      ...newsletter,
      generatedAt: newsletter.generatedAt.toISOString(),
      metadata: {
        totalArticles: newsletter.articles.length,
        language: newsletter.language,
        generatedAt: newsletter.generatedAt.toISOString(),
        categories: this.extractCategories(newsletter.articles)
      }
    };

    try {
      await writeFile(outputPath, JSON.stringify(formattedNewsletter, null, 2), 'utf-8');
      console.log(`Newsletter saved to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('Failed to save newsletter:', error);
      throw error;
    }
  }

  /**
   * Generate and save newsletter in one step
   */
  async createAndSaveNewsletter(
    articles: Article[], 
    language: Language = 'english',
    filename?: string
  ): Promise<{ newsletter: Newsletter; filePath: string }> {
    const newsletter = await this.generateNewsletter(articles, language);
    const filePath = await this.saveNewsletterAsJSON(newsletter, filename);

    return { newsletter, filePath };
  }

  /**
   * Generate newsletter with enhanced formatting
   */
  async generateEnhancedNewsletter(
    articles: Article[],
    language: Language = 'english',
    options: {
      includeImages?: boolean;
      groupByCategory?: boolean;
      includeMetadata?: boolean;
    } = {}
  ): Promise<any> {
    console.log(`Generating enhanced newsletter with ${articles.length} articles`);

    const { includeImages = false, groupByCategory = true, includeMetadata = true } = options;

    // Group articles by category if requested
    const processedArticles = groupByCategory 
      ? this.groupArticlesByCategory(articles)
      : articles;

    const newsletterData: any = {
      generatedAt: new Date().toISOString(),
      language,
      totalArticles: articles.length
    };

    if (includeMetadata) {
      newsletterData.metadata = {
        categories: this.extractCategories(articles),
        sources: [...new Set(articles.map(a => a.source))],
        dateRange: {
          earliest: articles.reduce((min, a) => a.publishedAt < min ? a.publishedAt : min, articles[0]?.publishedAt)?.toISOString(),
          latest: articles.reduce((max, a) => a.publishedAt > max ? a.publishedAt : max, articles[0]?.publishedAt)?.toISOString()
        }
      };
    }

    if (groupByCategory && typeof processedArticles === 'object') {
      newsletterData.articlesByCategory = {};
      for (const [category, categoryArticles] of Object.entries(processedArticles)) {
        newsletterData.articlesByCategory[category] = categoryArticles.map(article => 
          this.formatArticleForNewsletter(article as Article, includeImages)
        );
      }
    } else {
      newsletterData.articles = (processedArticles as Article[]).map(article => 
        this.formatArticleForNewsletter(article, includeImages)
      );
    }

    return newsletterData;
  }

  /**
   * Save enhanced newsletter
   */
  async saveEnhancedNewsletter(
    articles: Article[],
    language: Language = 'english',
    filename?: string,
    options: {
      includeImages?: boolean;
      groupByCategory?: boolean;
      includeMetadata?: boolean;
    } = {}
  ): Promise<string> {
    const enhancedNewsletter = await this.generateEnhancedNewsletter(articles, language, options);
    
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultFilename = `enhanced-newsletter-${language}-${timestamp}.json`;
    const outputFilename = filename || defaultFilename;
    const outputPath = join(appConfig.OUTPUT_DIR, outputFilename);

    try {
      await writeFile(outputPath, JSON.stringify(enhancedNewsletter, null, 2), 'utf-8');
      console.log(`Enhanced newsletter saved to: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('Failed to save enhanced newsletter:', error);
      throw error;
    }
  }

  /**
   * Generate newsletter preview (limited articles)
   */
  generatePreview(articles: Article[], maxArticles: number = 5): any {
    const previewArticles = articles.slice(0, maxArticles);
    
    return {
      preview: true,
      totalArticles: articles.length,
      previewCount: previewArticles.length,
      articles: previewArticles.map(article => ({
        title: article.title,
        author: article.author,
        source: article.source,
        publishedAt: article.publishedAt.toISOString(),
        summary: article.summary?.substring(0, 100) + '...' || 'No summary available',
        link: article.url
      }))
    };
  }

  /**
   * Format article for newsletter output
   */
  private formatArticleForNewsletter(article: Article, includeImages: boolean = false): any {
    const formatted: any = {
      title: article.title,
      author: article.author,
      source: article.source,
      publishedAt: article.publishedAt.toISOString(),
      summary: article.summary || article.description || 'No summary available',
      link: article.url
    };

    if (includeImages && article.imageUrl) {
      formatted.imageUrl = article.imageUrl;
    }

    return formatted;
  }

  /**
   * Group articles by category
   */
  private groupArticlesByCategory(articles: Article[]): Record<string, Article[]> {
    const grouped: Record<string, Article[]> = {};

    for (const article of articles) {
      if (!grouped[article.category]) {
        grouped[article.category] = [];
      }
      grouped[article.category].push(article);
    }

    // Sort articles within each category by publication date
    for (const category in grouped) {
      grouped[category].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
    }

    return grouped;
  }

  /**
   * Extract unique categories from articles
   */
  private extractCategories(articles: NewsletterArticle[] | Article[]): string[] {
    if (articles.length === 0) return [];
    
    // Check if articles have category property (Article type)
    const categorizedArticles = articles.filter((article): article is Article => 
      'category' in article
    ) as Article[];

    if (categorizedArticles.length === 0) return [];

    return [...new Set(categorizedArticles.map(article => article.category))];
  }
}