#!/usr/bin/env tsx

import { getDatabase } from '../database/connection.js';
import { LLMService } from '../services/llm.js';
import { TranslatedArticle } from '../repositories/newsletter-translation-job.js';

interface TranslationJob {
  id: string;
  title: string;
  content: string;
  source_language: string;
  target_languages: string[];
  status: string;
  original_articles: any[];
}

async function processTranslationJobWithArticles(jobId: string) {
  const db = getDatabase();
  const llmService = new LLMService();

  try {
    console.log(`Processing translation job ${jobId} with article-level translations...`);

    // Get the job details
    const job = await db.get<TranslationJob>(`
      SELECT * FROM newsletter_translation_jobs WHERE id = $1 AND status = 'processing'
    `, jobId);

    if (!job) {
      console.log(`Job ${jobId} not found or not in processing state`);
      return;
    }

    console.log(`Found job: ${job.title}`);
    console.log(`Languages to translate: ${job.target_languages.join(', ')}`);
    console.log(`Articles to translate: ${job.original_articles.length}`);

    // Update initial progress
    await db.run(`
      UPDATE newsletter_translation_jobs 
      SET progress = $1, updated_at = $2
      WHERE id = $3
    `, 5, new Date().toISOString(), jobId);

    const translatedArticles: Record<string, TranslatedArticle[]> = {};
    const translatedContent: Record<string, string> = {};

    // Initialize result structure for each target language
    for (const targetLang of job.target_languages) {
      translatedArticles[targetLang] = [];
    }

    // Process each article individually
    const totalTasks = job.original_articles.length * job.target_languages.length * 2; // title + summary per article per language
    let completedTasks = 0;

    for (let articleIndex = 0; articleIndex < job.original_articles.length; articleIndex++) {
      const article = job.original_articles[articleIndex];
      
      console.log(`\\n📰 Processing article ${articleIndex + 1}/${job.original_articles.length}: ${article.title}`);
      
      // First, generate summary for the article if not available
      let summary = article.description || article.summary;
      
      if (!summary && article.content) {
        try {
          console.log(`  📝 Generating summary for article...`);
          const summaryResult = await llmService.summarizeText({
            text: article.content,
            language: job.source_language as any,
            maxLength: 200,
            style: 'brief'
          });
          summary = summaryResult.summary;
          console.log(`  ✅ Summary generated: ${summary.substring(0, 100)}...`);
        } catch (error) {
          console.warn(`  ⚠️ Could not generate summary for article ${article.id}:`, error);
          summary = article.title; // Fallback to title
        }
      }

      // Translate to each target language
      for (const targetLang of job.target_languages) {
        console.log(`  🌍 Translating to ${targetLang}...`);

        try {
          // Translate title
          console.log(`    📖 Translating title...`);
          const titleTranslation = await llmService.translateText({
            text: article.title,
            sourceLanguage: job.source_language as any,
            targetLanguage: targetLang as any,
            contentType: 'title'
          });

          // Translate summary
          console.log(`    📄 Translating summary...`);
          const summaryTranslation = await llmService.translateText({
            text: summary,
            sourceLanguage: job.source_language as any,
            targetLanguage: targetLang as any,
            contentType: 'description'
          });

          // Store the translations
          const translatedArticle: TranslatedArticle = {
            id: article.id,
            title: { [targetLang]: titleTranslation.translatedText },
            summary: { [targetLang]: summaryTranslation.translatedText }
          };

          // Find existing article or add new one
          let existingArticle = translatedArticles[targetLang].find(a => a.id === article.id);
          if (existingArticle) {
            existingArticle.title[targetLang] = titleTranslation.translatedText;
            existingArticle.summary[targetLang] = summaryTranslation.translatedText;
          } else {
            translatedArticles[targetLang].push(translatedArticle);
          }

          completedTasks += 2; // title + summary
          const progress = Math.round((completedTasks / totalTasks) * 85) + 5; // Reserve 5% start, 10% end
          
          await db.run(`
            UPDATE newsletter_translation_jobs 
            SET progress = $1, updated_at = $2
            WHERE id = $3
          `, progress, new Date().toISOString(), jobId);

          console.log(`    ✅ ${targetLang} translation completed (${progress}% total progress)`);

        } catch (error) {
          console.error(`    ❌ Error translating article ${article.id} to ${targetLang}:`, error);
          throw error;
        }
      }
    }

    // Generate translated newsletter content
    console.log(`\\n📰 Generating translated newsletter content...`);
    for (const targetLang of job.target_languages) {
      try {
        // Build newsletter content in the target language
        let newsletterContent = await llmService.translateText({
          text: job.title,
          sourceLanguage: job.source_language as any,
          targetLanguage: targetLang as any,
          contentType: 'title'
        });

        let content = newsletterContent.translatedText + "\\n\\n";
        
        // Add translated articles
        const articles = translatedArticles[targetLang];
        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          const originalArticle = job.original_articles.find(a => a.id === article.id);
          
          content += `${i + 1}. ${article.title[targetLang]}\\n`;
          content += `${article.summary[targetLang]}\\n`;
          if (originalArticle?.url) {
            content += `${await llmService.translateText({
              text: 'Read more:',
              sourceLanguage: 'en' as any,
              targetLanguage: targetLang as any
            }).then(r => r.translatedText)} ${originalArticle.url}\\n`;
          }
          content += "\\n";
        }

        content += await llmService.translateText({
          text: 'Thank you for reading!',
          sourceLanguage: 'en' as any,
          targetLanguage: targetLang as any
        }).then(r => r.translatedText);

        translatedContent[targetLang] = content;
        
      } catch (error) {
        console.error(`Error generating newsletter content for ${targetLang}:`, error);
        throw error;
      }
    }

    // Mark as completed
    await db.run(`
      UPDATE newsletter_translation_jobs 
      SET status = 'completed', 
          progress = 100, 
          translated_content = $1,
          translated_articles = $2,
          completed_at = $3,
          updated_at = $3
      WHERE id = $4
    `, JSON.stringify(translatedContent), JSON.stringify(translatedArticles), new Date().toISOString(), jobId);

    console.log(`\\n✅ Job ${jobId} completed successfully!`);
    console.log(`📊 Translation Summary:`);
    for (const targetLang of job.target_languages) {
      const articles = translatedArticles[targetLang];
      console.log(`  ${targetLang.toUpperCase()}: ${articles.length} articles translated (titles + summaries)`);
    }

  } catch (error) {
    console.error(`❌ Error processing job ${jobId}:`, error);
    
    // Mark as failed
    await db.run(`
      UPDATE newsletter_translation_jobs 
      SET status = 'failed', 
          error_message = $1,
          updated_at = $2
      WHERE id = $3
    `, (error as Error).message, new Date().toISOString(), jobId);
  }
}

async function processAllPendingJobs() {
  const db = getDatabase();

  try {
    // Get all processing jobs
    const processingJobs = await db.all<TranslationJob>(`
      SELECT id, title FROM newsletter_translation_jobs WHERE status = 'processing'
    `);

    if (processingJobs.length === 0) {
      console.log('No processing jobs found.');
      return;
    }

    console.log(`Found ${processingJobs.length} processing jobs`);

    for (const job of processingJobs) {
      await processTranslationJobWithArticles(job.id);
    }

  } catch (error) {
    console.error('Error processing jobs:', error);
  }
}

// Get job ID from command line argument or process all
const jobId = process.argv[2];

if (jobId) {
  processTranslationJobWithArticles(jobId)
    .then(() => {
      console.log('Article translation processing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Article translation processing failed:', error);
      process.exit(1);
    });
} else {
  processAllPendingJobs()
    .then(() => {
      console.log('All article translation jobs processed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Article translation processing failed:', error);
      process.exit(1);
    });
}