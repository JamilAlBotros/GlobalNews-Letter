import { randomUUID } from 'crypto';
import { LLMService } from './llm.js';
import type { 
  Article, 
  NewsAPIArticle, 
  Category, 
  Language 
} from '../types/index.js';

/**
 * Service focused on processing articles with LLM
 * Handles conversion from NewsAPI format and AI processing
 */
export class ArticleProcessingService {
  private llmService: LLMService;

  constructor(llmService: LLMService) {
    this.llmService = llmService;
  }

  /**
   * Process NewsAPI articles into internal Article format with AI summaries
   */
  async processNewsAPIArticles(
    newsArticles: NewsAPIArticle[],
    category: Category,
    language: Language
  ): Promise<Article[]> {
    const articles: Article[] = [];

    for (const newsArticle of newsArticles) {
      try {
        const article = await this.processNewsAPIArticle(newsArticle, category, language);
        articles.push(article);
      } catch (error) {
        console.warn(`Failed to process article: ${newsArticle.title}`, error);
        // Continue processing other articles
      }
    }

    return articles;
  }

  /**
   * Process a single NewsAPI article
   */
  async processNewsAPIArticle(
    newsArticle: NewsAPIArticle,
    category: Category,
    language: Language
  ): Promise<Article> {
    // Generate summary using LLM
    const { summary } = await this.llmService.processArticle(
      newsArticle.title,
      newsArticle.description,
      newsArticle.content,
      language
    );

    const article: Article = {
      id: randomUUID(),
      title: newsArticle.title,
      author: newsArticle.author,
      description: newsArticle.description,
      url: newsArticle.url,
      imageUrl: newsArticle.urlToImage,
      publishedAt: new Date(newsArticle.publishedAt),
      content: newsArticle.content,
      category,
      source: newsArticle.source.name,
      summary,
      language,
      originalLanguage: language,
      isSelected: false,
      createdAt: new Date()
    };

    return article;
  }

  /**
   * Translate an existing article to a different language
   */
  async translateArticle(
    article: Article, 
    targetLanguage: Language
  ): Promise<Article> {
    if (article.language === targetLanguage) {
      console.log(`Article is already in ${targetLanguage}`);
      return article;
    }

    console.log(`Translating article to ${targetLanguage}...`);
    
    const { summary, translatedTitle } = await this.llmService.processArticle(
      article.title,
      article.description,
      article.content,
      targetLanguage
    );

    const translatedArticle: Article = {
      ...article,
      id: randomUUID(), // New ID for translated version
      title: translatedTitle || article.title,
      summary,
      language: targetLanguage,
      createdAt: new Date()
    };

    return translatedArticle;
  }

  /**
   * Re-process an article with updated AI summary
   */
  async reprocessArticle(
    article: Article, 
    targetLanguage?: Language
  ): Promise<Article> {
    const language = targetLanguage || article.language;
    
    const { summary, translatedTitle } = await this.llmService.processArticle(
      article.title,
      article.description,
      article.content,
      language
    );

    return {
      ...article,
      summary,
      title: translatedTitle || article.title,
      language,
      createdAt: new Date()
    };
  }

  /**
   * Test LLM service connectivity
   */
  async testLLMConnection(): Promise<boolean> {
    return await this.llmService.testConnection();
  }
}