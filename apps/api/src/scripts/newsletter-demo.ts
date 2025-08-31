#!/usr/bin/env tsx

import { newsletterService, NewsletterData } from '../services/newsletter.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function demo() {
  console.log('🔧 Newsletter Service Demo');
  console.log('============================\n');

  // Sample newsletter data
  const sampleData: NewsletterData = {
    title: 'Global News Weekly',
    intro: 'Welcome to your weekly digest of global news and insights.',
    articles: [
      {
        url: 'https://example.com/tech-breakthrough',
        title: 'Revolutionary AI Breakthrough in Healthcare',
        description: 'New AI system diagnoses diseases with 99% accuracy'
      },
      {
        url: 'https://example.com/climate-news',
        title: 'Major Climate Agreement Reached',
        description: 'World leaders agree on new carbon reduction targets'
      },
      {
        url: 'https://example.com/economic-update',
        title: 'Global Economic Recovery Shows Promise',
        description: 'Markets respond positively to new trade agreements'
      },
      {
        url: 'https://example.com/space-mission',
        title: 'Successful Mars Sample Return Mission',
        description: 'Scientists receive first samples from Mars surface'
      },
      {
        url: 'https://example.com/energy-news',
        title: 'Breakthrough in Fusion Energy Technology',
        description: 'New reactor design promises clean unlimited energy'
      }
    ],
    footer: 'Thank you for reading Global News Weekly. Stay informed!'
  };

  try {
    console.log('📝 Generating LTR Newsletter...');
    const ltrNewsletter = newsletterService.generateDynamicNewsletter(sampleData, 'ltr');
    
    console.log('📝 Generating RTL Newsletter...');
    const rtlNewsletter = newsletterService.generateDynamicNewsletter(sampleData, 'rtl');

    // Save newsletters
    const outputDir = join(process.cwd(), 'newsletter_output');
    
    // Create output directory if it doesn't exist
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    const ltrPath = join(outputDir, 'newsletter_ltr.html');
    const rtlPath = join(outputDir, 'newsletter_rtl.html');

    writeFileSync(ltrPath, ltrNewsletter, 'utf8');
    writeFileSync(rtlPath, rtlNewsletter, 'utf8');

    console.log('✅ Newsletters generated successfully!');
    console.log(`📄 LTR Newsletter: ${ltrPath}`);
    console.log(`📄 RTL Newsletter: ${rtlPath}`);

    // Generate preview newsletters
    console.log('\n📋 Generating Preview Newsletters...');
    const ltrPreview = newsletterService.generatePreview('ltr');
    const rtlPreview = newsletterService.generatePreview('rtl');

    const ltrPreviewPath = join(outputDir, 'preview_ltr.html');
    const rtlPreviewPath = join(outputDir, 'preview_rtl.html');

    writeFileSync(ltrPreviewPath, ltrPreview, 'utf8');
    writeFileSync(rtlPreviewPath, rtlPreview, 'utf8');

    console.log(`📄 LTR Preview: ${ltrPreviewPath}`);
    console.log(`📄 RTL Preview: ${rtlPreviewPath}`);

    // Test with articles from database format
    console.log('\n🔄 Testing with database article format...');
    const dbArticles = [
      {
        title: 'Breaking: Technology Advancement in AI',
        url: 'https://example.com/tech-ai',
        description: 'Latest AI developments reshape industry',
        detected_language: 'english'
      },
      {
        title: 'أخبار عاجلة: تطورات تقنية جديدة',
        url: 'https://example.com/arabic-news',
        description: 'تطورات مهمة في عالم التكنولوجيا',
        detected_language: 'arabic'
      },
      {
        title: 'Economic Recovery Continues',
        url: 'https://example.com/economy',
        description: 'Markets show positive trends',
        detected_language: 'english'
      }
    ];

    const autoNewsletter = newsletterService.generateFromArticles(dbArticles, {
      newsletterTitle: 'Auto-Generated Newsletter',
      intro: 'This newsletter was generated automatically from detected articles.'
    });

    const autoPath = join(outputDir, 'auto_generated.html');
    writeFileSync(autoPath, autoNewsletter, 'utf8');
    console.log(`📄 Auto-Generated Newsletter: ${autoPath}`);

    console.log('\n🎉 Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error generating newsletter:', error);
    process.exit(1);
  }
}

// Run demo if this file is executed directly
demo().catch(console.error);

export { demo };