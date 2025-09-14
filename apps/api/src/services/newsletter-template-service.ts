import { newsletterSectionRepository } from '../repositories/newsletter-section-repository.js';
import type { CreateNewsletterSectionInputType } from '@mtrx/contracts';

export class NewsletterTemplateService {
  
  private defaultSections: CreateNewsletterSectionInputType[] = [
    // Header Section
    {
      name: 'newsletter_header',
      display_name: 'Newsletter Header',
      section_type: 'header',
      template_content: `
<div class="newsletter-header" style="text-align: center; padding: 20px; border-bottom: 2px solid #e5e7eb;">
  <h1 style="font-size: 2.5rem; font-weight: bold; color: #1f2937; margin: 0;">{{newsletter_title}}</h1>
  {{#if subtitle}}
  <p style="font-size: 1.125rem; color: #6b7280; margin-top: 8px;">{{subtitle}}</p>
  {{/if}}
  <p style="color: #9ca3af; font-size: 0.875rem; margin-top: 12px;">{{publish_date}}</p>
</div>
      `.trim(),
      is_recurring: true,
      display_order: 1,
      metadata: {
        description: 'Standard newsletter header with title, subtitle, and date',
        variables: ['newsletter_title', 'subtitle', 'publish_date']
      }
    },

    // Top News Section  
    {
      name: 'top_news_section',
      display_name: 'Top News',
      section_type: 'top_news',
      template_content: `
<div class="top-news-section" style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
  <h2 style="font-size: 1.875rem; font-weight: bold; color: #1f2937; margin-bottom: 16px; border-left: 4px solid #3b82f6; padding-left: 12px;">
    🔥 Top Stories
  </h2>
  
  {{#each articles}}
  <div class="article-item" style="margin-bottom: 20px; padding-bottom: 16px; {{#unless @last}}border-bottom: 1px solid #f3f4f6;{{/unless}}">
    <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 8px;">
      <a href="{{url}}" style="color: #1f2937; text-decoration: none;">{{title}}</a>
    </h3>
    {{#if description}}
    <p style="color: #6b7280; line-height: 1.5; margin-bottom: 8px;">{{description}}</p>
    {{/if}}
    <a href="{{url}}" style="color: #3b82f6; font-size: 0.875rem; font-weight: 500; text-decoration: none;">
      Read more →
    </a>
  </div>
  {{/each}}
</div>
      `.trim(),
      is_recurring: true,
      display_order: 2,
      metadata: {
        description: 'Featured top news stories section',
        variables: ['articles'],
        max_articles: 5
      }
    },

    // Market Trends Section
    {
      name: 'market_trends_section',
      display_name: 'Market Trends',
      section_type: 'market_trends',
      template_content: `
<div class="market-trends-section" style="padding: 24px; border-bottom: 1px solid #e5e7eb; background-color: #f8fafc;">
  <h2 style="font-size: 1.875rem; font-weight: bold; color: #1f2937; margin-bottom: 16px; border-left: 4px solid #10b981; padding-left: 12px;">
    📈 Market Trends
  </h2>
  
  {{#each articles}}
  <div class="trend-item" style="margin-bottom: 16px; padding: 12px; background: white; border-radius: 8px; border-left: 3px solid #10b981;">
    <h4 style="font-size: 1.125rem; font-weight: 600; margin-bottom: 4px;">
      <a href="{{url}}" style="color: #1f2937; text-decoration: none;">{{title}}</a>
    </h4>
    {{#if description}}
    <p style="color: #6b7280; font-size: 0.875rem; line-height: 1.4;">{{description}}</p>
    {{/if}}
  </div>
  {{/each}}
</div>
      `.trim(),
      is_recurring: true,
      display_order: 3,
      metadata: {
        description: 'Market trends and financial news section',
        variables: ['articles'],
        max_articles: 4
      }
    },

    // Custom Content Section
    {
      name: 'custom_content_section',
      display_name: 'Custom Content',
      section_type: 'custom',
      template_content: `
<div class="custom-section" style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
  <h2 style="font-size: 1.875rem; font-weight: bold; color: #1f2937; margin-bottom: 16px; border-left: 4px solid #8b5cf6; padding-left: 12px;">
    {{section_title}}
  </h2>
  
  <div style="color: #374151; line-height: 1.6;">
    {{custom_content}}
  </div>
  
  {{#if articles}}
  <div style="margin-top: 20px;">
    {{#each articles}}
    <div class="custom-article" style="margin-bottom: 12px; padding: 12px; border-left: 3px solid #8b5cf6;">
      <h4 style="font-weight: 600; margin-bottom: 4px;">
        <a href="{{url}}" style="color: #1f2937; text-decoration: none;">{{title}}</a>
      </h4>
      {{#if description}}
      <p style="color: #6b7280; font-size: 0.875rem;">{{description}}</p>
      {{/if}}
    </div>
    {{/each}}
  </div>
  {{/if}}
</div>
      `.trim(),
      is_recurring: false,
      display_order: 4,
      metadata: {
        description: 'Flexible custom content section',
        variables: ['section_title', 'custom_content', 'articles'],
        customizable: true
      }
    },

    // Footer Section
    {
      name: 'newsletter_footer',
      display_name: 'Newsletter Footer',
      section_type: 'footer',
      template_content: `
<div class="newsletter-footer" style="padding: 24px; text-align: center; background-color: #f9fafb; color: #6b7280; font-size: 0.875rem;">
  <p style="margin-bottom: 12px;">
    {{footer_text}}
  </p>
  
  <div style="margin: 16px 0; padding: 12px 0; border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb;">
    <p style="margin: 0;">
      📧 <strong>GlobalNews Letter</strong> | Curated by AI, delivered with care
    </p>
  </div>
  
  <p style="font-size: 0.75rem; color: #9ca3af; margin: 8px 0 0 0;">
    This newsletter was generated on {{generation_date}} | Issue #{{issue_number}}
  </p>
</div>
      `.trim(),
      is_recurring: true,
      display_order: 5,
      metadata: {
        description: 'Standard newsletter footer with branding',
        variables: ['footer_text', 'generation_date', 'issue_number']
      }
    }
  ];

  async seedDefaultSections(): Promise<void> {
    for (const sectionData of this.defaultSections) {
      // Check if section already exists
      const existing = await newsletterSectionRepository.findByType(sectionData.section_type);
      const sectionExists = existing.some(section => section.name === sectionData.name);
      
      if (!sectionExists) {
        await newsletterSectionRepository.create(sectionData);
        console.log(`Seeded section template: ${sectionData.display_name}`);
      }
    }
  }

  async getSectionTemplateLibrary(): Promise<{
    categories: Array<{
      type: string;
      display_name: string;
      description: string;
      sections: any[];
    }>;
    total_sections: number;
  }> {
    const allSections = await newsletterSectionRepository.findMany({ sortBy: 'display_order', sortOrder: 'ASC' });
    
    const categories = [
      {
        type: 'header',
        display_name: 'Headers',
        description: 'Newsletter headers and titles',
        sections: allSections.filter(s => s.section_type === 'header')
      },
      {
        type: 'top_news',
        display_name: 'Top News',
        description: 'Featured news and breaking stories',
        sections: allSections.filter(s => s.section_type === 'top_news')
      },
      {
        type: 'market_trends',
        display_name: 'Market Trends',
        description: 'Financial and market analysis',
        sections: allSections.filter(s => s.section_type === 'market_trends')
      },
      {
        type: 'custom',
        display_name: 'Custom Sections',
        description: 'Flexible content sections',
        sections: allSections.filter(s => s.section_type === 'custom')
      },
      {
        type: 'footer',
        display_name: 'Footers',
        description: 'Newsletter footers and signatures',
        sections: allSections.filter(s => s.section_type === 'footer')
      }
    ];

    return {
      categories,
      total_sections: allSections.length
    };
  }

  async createCustomSection(
    name: string,
    displayName: string,
    templateContent: string,
    sectionType: 'header' | 'top_news' | 'market_trends' | 'footer' | 'custom' = 'custom',
    metadata?: Record<string, any>
  ) {
    const maxOrder = await newsletterSectionRepository.getMaxDisplayOrder(sectionType);
    
    return await newsletterSectionRepository.create({
      name,
      display_name: displayName,
      section_type: sectionType,
      template_content: templateContent,
      is_recurring: false,
      display_order: maxOrder + 1,
      metadata: metadata || {}
    });
  }
}

export const newsletterTemplateService = new NewsletterTemplateService();