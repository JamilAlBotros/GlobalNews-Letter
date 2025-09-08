#!/usr/bin/env tsx

import { getDatabase } from '../database/connection.js';
import { LLMService } from '../services/llm.js';

interface TranslationJob {
  id: string;
  title: string;
  content: string;
  source_language: string;
  target_languages: string[];
  status: string;
}

async function processTranslationJob(jobId: string) {
  const db = getDatabase();
  const llmService = new LLMService();

  try {
    console.log(`Processing translation job ${jobId}...`);

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

    // Update progress
    await db.run(`
      UPDATE newsletter_translation_jobs 
      SET progress = $1, updated_at = $2
      WHERE id = $3
    `, 10, new Date().toISOString(), jobId);

    const translatedContent: Record<string, string> = {};

    // Translate to each target language
    for (let i = 0; i < job.target_languages.length; i++) {
      const targetLang = job.target_languages[i];
      console.log(`Translating to ${targetLang}...`);

      try {
        const translation = await llmService.translateText({
          text: job.content,
          sourceLanguage: job.source_language as any,
          targetLanguage: targetLang as any,
          contentType: 'content'
        });

        translatedContent[targetLang] = translation.translatedText;
        
        // Update progress
        const progress = Math.round(((i + 1) / job.target_languages.length) * 90) + 10;
        await db.run(`
          UPDATE newsletter_translation_jobs 
          SET progress = $1, updated_at = $2
          WHERE id = $3
        `, progress, new Date().toISOString(), jobId);

        console.log(`✓ Translated to ${targetLang} (${progress}% complete)`);

      } catch (error) {
        console.error(`Error translating to ${targetLang}:`, error);
        throw error;
      }
    }

    // Mark as completed
    await db.run(`
      UPDATE newsletter_translation_jobs 
      SET status = 'completed', 
          progress = 100, 
          translated_content = $1,
          completed_at = $2,
          updated_at = $2
      WHERE id = $3
    `, JSON.stringify(translatedContent), new Date().toISOString(), jobId);

    console.log(`✅ Job ${jobId} completed successfully!`);
    console.log(`Translations completed for: ${Object.keys(translatedContent).join(', ')}`);

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
      await processTranslationJob(job.id);
    }

  } catch (error) {
    console.error('Error processing jobs:', error);
  }
}

// Get job ID from command line argument or process all
const jobId = process.argv[2];

if (jobId) {
  processTranslationJob(jobId)
    .then(() => {
      console.log('Translation job processing completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Translation job processing failed:', error);
      process.exit(1);
    });
} else {
  processAllPendingJobs()
    .then(() => {
      console.log('All translation jobs processed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Translation job processing failed:', error);
      process.exit(1);
    });
}