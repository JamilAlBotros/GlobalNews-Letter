#!/usr/bin/env tsx

import { getDatabase } from '../database/connection.js';
import { LLMService } from '../services/llm.js';

interface TranslationJob {
  id: string;
  title: string;
  content: string;
  source_language: string;
  target_languages: string; // JSON string
  status: string;
}

class TranslationWorker {
  private db = getDatabase();
  private llmService = new LLMService();
  private isRunning = false;
  private pollInterval = 10000; // 10 seconds

  async start() {
    console.log('🤖 Translation Worker starting...');
    this.isRunning = true;
    
    // Initial processing
    await this.processAllPendingJobs();
    
    // Set up polling
    while (this.isRunning) {
      await this.sleep(this.pollInterval);
      await this.processAllPendingJobs();
    }
  }

  stop() {
    console.log('🛑 Translation Worker stopping...');
    this.isRunning = false;
  }

  private async processAllPendingJobs() {
    try {
      // Find pending jobs
      const pendingJobs = await this.db.all<TranslationJob>(`
        SELECT id, title FROM newsletter_translation_jobs 
        WHERE status = 'pending' 
        ORDER BY created_at ASC
      `);

      if (pendingJobs.length === 0) {
        return; // No work to do
      }

      console.log(`📋 Found ${pendingJobs.length} pending translation jobs`);

      for (const job of pendingJobs) {
        try {
          await this.processJob(job.id);
        } catch (error) {
          console.error(`❌ Error processing job ${job.id}:`, error);
          // Mark job as failed
          await this.db.run(`
            UPDATE newsletter_translation_jobs 
            SET status = 'failed', 
                error_message = $1,
                updated_at = $2
            WHERE id = $3
          `, (error as Error).message, new Date().toISOString(), job.id);
        }
      }
    } catch (error) {
      console.error('❌ Error in translation worker:', error);
    }
  }

  private async processJob(jobId: string) {
    console.log(`🔄 Processing job ${jobId}...`);

    // Move to processing status
    await this.db.run(`
      UPDATE newsletter_translation_jobs 
      SET status = 'processing', 
          assigned_worker = 'auto-worker',
          started_at = $1,
          progress = 0,
          updated_at = $1
      WHERE id = $2 AND status = 'pending'
    `, new Date().toISOString(), jobId);

    // Get job details
    const job = await this.db.get<TranslationJob>(`
      SELECT * FROM newsletter_translation_jobs WHERE id = $1 AND status = 'processing'
    `, jobId);

    if (!job) {
      console.log(`⚠️  Job ${jobId} not found or not in processing state`);
      return;
    }

    // Parse target languages
    const targetLanguages: string[] = JSON.parse(job.target_languages);
    
    console.log(`📝 Job: ${job.title}`);
    console.log(`🌐 Languages to translate: ${targetLanguages.join(', ')}`);

    // Update initial progress
    await this.db.run(`
      UPDATE newsletter_translation_jobs 
      SET progress = $1, updated_at = $2
      WHERE id = $3
    `, 10, new Date().toISOString(), jobId);

    const translatedContent: Record<string, string> = {};

    // Translate to each target language
    for (let i = 0; i < targetLanguages.length; i++) {
      const targetLang = targetLanguages[i];
      console.log(`🔤 Translating to ${targetLang}...`);

      try {
        const translation = await this.llmService.translateText({
          text: job.content,
          sourceLanguage: job.source_language as any,
          targetLanguage: targetLang as any,
          contentType: 'content'
        });

        translatedContent[targetLang] = translation.translatedText;
        
        // Update progress
        const progress = Math.round(((i + 1) / targetLanguages.length) * 90) + 10;
        await this.db.run(`
          UPDATE newsletter_translation_jobs 
          SET progress = $1, updated_at = $2
          WHERE id = $3
        `, progress, new Date().toISOString(), jobId);

        console.log(`✅ Translated to ${targetLang} (${progress}% complete)`);

      } catch (error) {
        console.error(`❌ Error translating to ${targetLang}:`, error);
        throw error;
      }
    }

    // Mark as completed
    await this.db.run(`
      UPDATE newsletter_translation_jobs 
      SET status = 'completed', 
          progress = 100, 
          translated_content = $1,
          completed_at = $2,
          updated_at = $2
      WHERE id = $3
    `, JSON.stringify(translatedContent), new Date().toISOString(), jobId);

    console.log(`🎉 Job ${jobId} completed successfully!`);
    console.log(`📊 Translations completed for: ${Object.keys(translatedContent).join(', ')}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Handle shutdown gracefully
const worker = new TranslationWorker();

process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  worker.stop();
  process.exit(0);
});

// Start the worker
worker.start().catch((error) => {
  console.error('💥 Translation worker failed:', error);
  process.exit(1);
});