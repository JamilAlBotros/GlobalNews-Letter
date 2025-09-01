import mjml from 'mjml';
import { readFileSync } from 'fs';
import { join } from 'path';

export interface NewsletterArticle {
  url: string;
  title: string;
  description?: string;
}

export interface NewsletterData {
  title: string;
  intro: string;
  articles: NewsletterArticle[];
  footer?: string;
}

export type NewsletterLanguage = 'ltr' | 'rtl';

export class NewsletterService {
  private templateDir: string;

  constructor(templateDir?: string) {
    this.templateDir = templateDir || join(process.cwd(), '..', '..', 'newsletter_template');
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
}

// Export default instance
export const newsletterService = new NewsletterService();