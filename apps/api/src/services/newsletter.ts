import mjml from 'mjml';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LLMService } from './llm.js';
import { ErrorHandler } from '../utils/errors.js';
import type { Language } from '../types/index.js';

export interface NewsletterArticle {
  url: string;
  title: string;
  description?: string;
  summary?: string;
}

export interface NewsletterData {
  title: string;
  intro: string;
  articles: NewsletterArticle[];
  footer?: string;
  language?: Language;
}

export type NewsletterLanguage = 'ltr' | 'rtl';

export class NewsletterService {
  private templateDir: string;
  private llmService: LLMService;

  constructor(templateDir?: string) {
    this.templateDir = templateDir || join(process.cwd(), '..', '..', 'newsletter_template');
    this.llmService = new LLMService();
  }

  /**
   * Generate HTML newsletter using MJML templates
   */
  generateNewsletter(data: NewsletterData, language: NewsletterLanguage = 'ltr'): string {
    const templatePath = this.getTemplatePath(language);
    let mjmlTemplate = readFileSync(templatePath, 'utf8');

    // Replace basic placeholders
    mjmlTemplate = mjmlTemplate
      .replace('{{TITLE}}', this.escapeHtml(data.title))
      .replace('{{INTRO}}', this.escapeHtml(data.intro))
      .replace('{{FOOTER}}', this.escapeHtml(data.footer || 'Thank you for reading!'));

    // Replace article links (up to 3 articles as per template)
    for (let i = 1; i <= 3; i++) {
      const article = data.articles[i - 1];
      if (article) {
        mjmlTemplate = mjmlTemplate
          .replace(`{{LINK${i}_URL}}`, article.url)
          .replace(`{{LINK${i}_TEXT}}`, this.escapeHtml(article.title));
      } else {
        // Remove unused placeholders
        mjmlTemplate = mjmlTemplate
          .replace(`{{LINK${i}_URL}}`, '#')
          .replace(`{{LINK${i}_TEXT}}`, '');
      }
    }

    // Convert MJML to HTML
    const result = mjml(mjmlTemplate, {
      validationLevel: 'soft',
      fonts: {
        'Courier New': 'https://fonts.googleapis.com/css?family=Courier+Prime',
        'Tahoma': 'https://fonts.googleapis.com/css?family=Tahoma'
      }
    });

    if (result.errors.length > 0) {
      console.warn('MJML template errors:', result.errors);
    }

    return result.html;
  }

  /**
   * Generate newsletter with dynamic article list
   */
  generateDynamicNewsletter(data: NewsletterData, language: NewsletterLanguage = 'ltr'): string {
    const templatePath = this.getTemplatePath(language);
    let mjmlTemplate = readFileSync(templatePath, 'utf8');

    // Replace basic placeholders
    mjmlTemplate = mjmlTemplate
      .replace('{{TITLE}}', this.escapeHtml(data.title))
      .replace('{{INTRO}}', this.escapeHtml(data.intro))
      .replace('{{FOOTER}}', this.escapeHtml(data.footer || 'Thank you for reading!'));

    // Generate dynamic article list HTML
    const articlesList = this.generateArticlesList(data.articles, language);
    
    // Replace the static list with dynamic content
    const listRegex = /<ul[^>]*>.*?<\/ul>/gs;
    mjmlTemplate = mjmlTemplate.replace(listRegex, articlesList);

    // Convert MJML to HTML
    const result = mjml(mjmlTemplate, {
      validationLevel: 'soft',
      fonts: {
        'Courier New': 'https://fonts.googleapis.com/css?family=Courier+Prime',
        'Tahoma': 'https://fonts.googleapis.com/css?family=Tahoma'
      }
    });

    if (result.errors.length > 0) {
      console.warn('MJML template errors:', result.errors);
    }

    return result.html;
  }

  /**
   * Generate newsletter from articles data with automatic language detection
   */
  generateFromArticles(
    articles: Array<{
      title: string;
      url: string;
      description?: string;
      detected_language?: string | null;
    }>,
    options: {
      newsletterTitle?: string;
      intro?: string;
      footer?: string;
      forceLanguage?: NewsletterLanguage;
    } = {}
  ): string {
    // Determine language direction based on detected languages
    const language = options.forceLanguage || this.detectLanguageDirection(articles);
    
    // Convert articles to newsletter format
    const newsletterArticles: NewsletterArticle[] = articles.map(article => ({
      url: article.url,
      title: article.title,
      description: article.description
    }));

    const newsletterData: NewsletterData = {
      title: options.newsletterTitle || 'Weekly News Update',
      intro: options.intro || 'Here are the latest news articles:',
      articles: newsletterArticles,
      footer: options.footer
    };

    return this.generateDynamicNewsletter(newsletterData, language);
  }

  /**
   * Generate a preview newsletter with sample data for testing
   */
  generatePreview(language: NewsletterLanguage = 'ltr'): string {
    const sampleData: NewsletterData = {
      title: 'Weekly Tech Update',
      intro: 'Here are this week\'s top technology stories:',
      articles: [
        {
          url: 'https://example.com/article1',
          title: 'Breaking: New AI Development Revolutionizes Industry',
          description: 'A groundbreaking artificial intelligence system has been announced...'
        },
        {
          url: 'https://example.com/article2', 
          title: 'Tech Giants Announce Major Partnership',
          description: 'Leading technology companies have formed an alliance...'
        },
        {
          url: 'https://example.com/article3',
          title: 'Cybersecurity Alert: New Threats Identified',
          description: 'Security researchers have discovered several new vulnerabilities...'
        }
      ],
      footer: 'Stay informed with our weekly newsletter. Unsubscribe anytime.'
    };

    return this.generateDynamicNewsletter(sampleData, language);
  }

  private getTemplatePath(language: NewsletterLanguage): string {
    const filename = language === 'rtl' ? 'rtl_template.mjml' : 'ltr_tempalte.mjml';
    return join(this.templateDir, filename);
  }

  private generateArticlesList(articles: NewsletterArticle[], language: NewsletterLanguage): string {
    if (articles.length === 0) {
      return '<ul><li>No articles available</li></ul>';
    }

    const listStyle = language === 'rtl' ? 'style="list-style-position: inside;"' : '';
    const articleItems = articles.map(article => 
      `<li><a href="${article.url}" style="color:#00ff00;">${this.escapeHtml(article.title)}</a></li>`
    ).join('\n            ');

    return `<ul ${listStyle}>\n            ${articleItems}\n          </ul>`;
  }

  private detectLanguageDirection(articles: Array<{ detected_language?: string | null }>): NewsletterLanguage {
    const rtlLanguages = ['arabic'];
    const detectedLanguages = articles
      .map(a => a.detected_language)
      .filter(Boolean) as string[];

    // If majority of articles are RTL languages, use RTL template
    const rtlCount = detectedLanguages.filter(lang => rtlLanguages.includes(lang.toLowerCase())).length;
    return rtlCount > detectedLanguages.length / 2 ? 'rtl' : 'ltr';
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Save newsletter HTML to file
   */
  saveNewsletter(html: string, filename: string): void {
    const { writeFileSync } = require('fs');
    writeFileSync(filename, html, 'utf8');
  }

  /**
   * Generate enhanced newsletter with AI-powered content
   */
  async generateEnhancedNewsletter(
    articles: Array<{
      title: string;
      url: string;
      description?: string;
      summary?: string;
      detected_language?: string | null;
    }>,
    targetLanguage: Language = 'en',
    options: {
      newsletterTitle?: string;
      intro?: string;
      footer?: string;
      maxArticles?: number;
    } = {}
  ): Promise<string> {
    try {
      const { 
        newsletterTitle = 'Daily News Digest',
        intro = 'Here are today\'s top stories:',
        footer = 'Thank you for reading!',
        maxArticles = 5
      } = options;

      // Process articles with LLM enhancement
      const enhancedArticles: NewsletterArticle[] = [];
      const selectedArticles = articles.slice(0, maxArticles);

      for (const article of selectedArticles) {
        try {
          let enhancedArticle: NewsletterArticle = {
            url: article.url,
            title: article.title,
            description: article.description,
            summary: article.summary
          };

          // Translate title if needed
          const detectedLang = article.detected_language as Language || 'en';
          if (detectedLang !== targetLanguage) {
            try {
              const translationResponse = await this.llmService.translateText({
                text: article.title,
                sourceLanguage: detectedLang,
                targetLanguage,
                contentType: 'title'
              });
              enhancedArticle.title = translationResponse.translatedText;
            } catch (error) {
              ErrorHandler.logError(error as Error, { 
                operation: 'title translation', 
                articleUrl: article.url 
              });
              // Keep original title on translation error
            }
          }

          // Generate or enhance summary if needed
          if (!enhancedArticle.summary && (article.description || article.title)) {
            try {
              const summaryResponse = await this.llmService.summarizeText({
                text: article.description || article.title,
                language: targetLanguage,
                maxLength: 150,
                style: 'brief'
              });
              enhancedArticle.summary = summaryResponse.summary;
            } catch (error) {
              ErrorHandler.logError(error as Error, { 
                operation: 'summary generation', 
                articleUrl: article.url 
              });
              enhancedArticle.summary = article.description || 'Summary not available';
            }
          }

          enhancedArticles.push(enhancedArticle);
        } catch (error) {
          ErrorHandler.logError(error as Error, { 
            operation: 'article enhancement', 
            articleUrl: article.url 
          });
          // Add article without enhancement on error
          enhancedArticles.push({
            url: article.url,
            title: article.title,
            description: article.description,
            summary: article.summary || article.description
          });
        }
      }

      // Generate newsletter data
      const newsletterData: NewsletterData = {
        title: newsletterTitle,
        intro,
        articles: enhancedArticles,
        footer,
        language: targetLanguage
      };

      // Determine text direction based on language
      const language: NewsletterLanguage = ['ar'].includes(targetLanguage) ? 'rtl' : 'ltr';
      
      return this.generateDynamicNewsletter(newsletterData, language);
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'generateEnhancedNewsletter' });
      throw error;
    }
  }

  /**
   * Generate newsletter intro text using LLM
   */
  async generateNewsletterIntro(
    articles: NewsletterArticle[],
    language: Language = 'en',
    style: 'professional' | 'casual' | 'brief' = 'professional'
  ): Promise<string> {
    try {
      const articleTitles = articles.slice(0, 3).map(a => a.title).join(', ');
      const prompt = `Create a ${style} newsletter introduction for these top stories: ${articleTitles}`;
      
      const response = await this.llmService.summarizeText({
        text: prompt,
        language,
        maxLength: 200,
        style: style === 'brief' ? 'brief' : 'detailed'
      });

      return response.summary;
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'generateNewsletterIntro' });
      return 'Welcome to today\'s newsletter! Here are the latest stories we\'ve curated for you.';
    }
  }

  /**
   * Test LLM service connectivity
   */
  async testLLMConnection(): Promise<boolean> {
    try {
      return await this.llmService.testConnection();
    } catch (error) {
      ErrorHandler.logError(error as Error, { operation: 'testLLMConnection' });
      return false;
    }
  }
}

// Export default instance
export const newsletterService = new NewsletterService();