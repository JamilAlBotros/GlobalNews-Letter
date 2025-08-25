import { GoogleRSSDatabaseManager } from '../database/google-rss-schema.js';
import type { ArticleLink, ProcessedArticle } from '../database/google-rss-schema.js';
import fetch from 'node-fetch';
import crypto from 'crypto';

/**
 * Article Processing Service
 * Handles the pipeline: Links → Extract article text → Summarize → Save results
 */

export interface ExtractionResult {
  text: string;
  title: string;
  wordCount: number;
  method: string;
  quality: 'high' | 'medium' | 'low' | 'failed';
  error?: string;
}

export interface SummaryResult {
  summary: string;
  method: string;
  quality: 'high' | 'medium' | 'low' | 'failed';
  error?: string;
}

export class ArticleProcessor {
  private dbManager: GoogleRSSDatabaseManager;
  private isRunning = false;
  private processedCount = 0;
  private errorCount = 0;

  constructor(dbPath?: string) {
    this.dbManager = new GoogleRSSDatabaseManager(dbPath);
  }

  async initialize(): Promise<void> {
    await this.dbManager.initialize();
  }

  /**
   * Start continuous processing of pending articles
   */
  async startContinuousProcessing(batchSize: number = 10, intervalMinutes: number = 5): Promise<void> {
    if (this.isRunning) {
      console.log('⚙️ Article processor is already running');
      return;
    }

    console.log(`🚀 Starting continuous article processing`);
    console.log(`📊 Batch size: ${batchSize} articles`);
    console.log(`⏰ Processing interval: ${intervalMinutes} minutes`);
    
    this.isRunning = true;
    this.processedCount = 0;
    this.errorCount = 0;

    const processLoop = async () => {
      if (!this.isRunning) return;
      
      try {
        console.log(`\n⏳ ${new Date().toLocaleString()} - Processing batch...`);
        const processed = await this.processBatch(batchSize);
        
        if (processed === 0) {
          console.log('✅ No pending articles to process');
        } else {
          console.log(`✅ Processed ${processed} articles in batch`);
        }
        
        // Schedule next batch
        setTimeout(processLoop, intervalMinutes * 60 * 1000);
      } catch (error) {
        console.error('❌ Error in processing loop:', error instanceof Error ? error.message : error);
        setTimeout(processLoop, intervalMinutes * 60 * 1000); // Continue despite errors
      }
    };

    // Start processing loop
    processLoop();
    
    console.log('✅ Continuous processing started');
    console.log('💡 Press Ctrl+C to stop');
  }

  /**
   * Stop continuous processing
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('🛑 Processor is not running');
      return;
    }

    console.log('🛑 Stopping article processor...');
    this.isRunning = false;
    
    console.log(`📊 Final stats: ${this.processedCount} processed, ${this.errorCount} errors`);
    console.log('✅ Article processor stopped');
  }

  /**
   * Process a batch of pending articles
   */
  async processBatch(batchSize: number = 10): Promise<number> {
    const pendingLinks = await this.dbManager.getPendingLinks(batchSize);
    
    if (pendingLinks.length === 0) {
      return 0;
    }

    console.log(`📝 Processing ${pendingLinks.length} articles...`);
    let processedCount = 0;

    for (const link of pendingLinks) {
      try {
        await this.processArticle(link);
        processedCount++;
        this.processedCount++;
        
        // Brief pause between articles to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to process article ${link.id}: ${error instanceof Error ? error.message : error}`);
        await this.dbManager.updateLinkProcessingStage(link.id, 'failed', error instanceof Error ? error.message : String(error));
        this.errorCount++;
      }
    }

    return processedCount;
  }

  /**
   * Process a single article through the complete pipeline
   */
  async processArticle(link: ArticleLink): Promise<void> {
    console.log(`🔄 Processing: ${link.title.substring(0, 60)}...`);

    try {
      // Update stage to extracting
      await this.dbManager.updateLinkProcessingStage(link.id, 'extracting');
      
      // Step 1: Extract article text
      const extraction = await this.extractArticleText(link.link);
      
      if (extraction.quality === 'failed') {
        await this.dbManager.updateLinkProcessingStage(link.id, 'failed', extraction.error);
        return;
      }

      // Update stage to summarizing
      await this.dbManager.updateLinkProcessingStage(link.id, 'summarizing');
      
      // Step 2: Generate summary (optional, can be skipped for now)
      let summary: SummaryResult | null = null;
      try {
        summary = await this.generateSummary(extraction.text);
      } catch (summaryError) {
        console.warn(`⚠️ Summary generation failed for ${link.id}, continuing without summary`);
      }

      // Step 3: Save processed article
      const processedArticle: Omit<ProcessedArticle, 'createdAt'> = {
        id: crypto.randomUUID(),
        linkId: link.id,
        feedId: link.feedId,
        title: extraction.title || link.title,
        originalUrl: link.link,
        extractedText: extraction.text,
        summary: summary?.summary || '',
        wordCount: extraction.wordCount,
        extractionMethod: extraction.method,
        summaryMethod: summary?.method || '',
        quality: extraction.quality,
        tags: JSON.stringify([]), // Will be populated later with topic extraction
        processedAt: new Date().toISOString()
      };

      await this.dbManager.saveProcessedArticle(processedArticle);
      
      // Mark as completed
      await this.dbManager.updateLinkProcessingStage(link.id, 'completed');
      
      // Update daily stats
      const today = new Date().toISOString().split('T')[0];
      if (link.feedId) {
        await this.dbManager.updateProcessingStats(link.feedId, today, {
          articlesExtracted: 1,
          articlesSummarized: summary ? 1 : 0
        });
      }

      console.log(`   ✅ Completed (${extraction.wordCount} words, ${extraction.quality} quality)`);

    } catch (error) {
      console.error(`   ❌ Processing failed: ${error instanceof Error ? error.message : error}`);
      await this.dbManager.updateLinkProcessingStage(link.id, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Extract article text from URL using multiple methods
   */
  private async extractArticleText(url: string): Promise<ExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Method 1: Simple HTML fetch and basic text extraction
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        return {
          text: '',
          title: '',
          wordCount: 0,
          method: 'http_error',
          quality: 'failed',
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const html = await response.text();
      const extractionTime = Date.now() - startTime;
      
      // Basic HTML text extraction
      const result = this.extractTextFromHTML(html);
      
      // Determine quality based on content length and extraction time
      let quality: 'high' | 'medium' | 'low' | 'failed' = 'medium';
      
      if (result.wordCount === 0) {
        quality = 'failed';
      } else if (result.wordCount < 100) {
        quality = 'low';
      } else if (result.wordCount > 500 && extractionTime < 10000) {
        quality = 'high';
      }

      return {
        ...result,
        method: 'html_basic',
        quality
      };

    } catch (error) {
      return {
        text: '',
        title: '',
        wordCount: 0,
        method: 'extraction_error',
        quality: 'failed',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Basic HTML text extraction (simplified version)
   * In the future, this could be enhanced with libraries like readability or cheerio
   */
  private extractTextFromHTML(html: string): { text: string; title: string; wordCount: number } {
    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || '';

    // Remove script and style tags
    let cleanHtml = html.replace(/<script[^>]*>.*?<\/script>/gis, '');
    cleanHtml = cleanHtml.replace(/<style[^>]*>.*?<\/style>/gis, '');
    
    // Remove HTML tags
    cleanHtml = cleanHtml.replace(/<[^>]+>/g, ' ');
    
    // Decode HTML entities (basic ones)
    cleanHtml = cleanHtml.replace(/&nbsp;/g, ' ');
    cleanHtml = cleanHtml.replace(/&amp;/g, '&');
    cleanHtml = cleanHtml.replace(/&lt;/g, '<');
    cleanHtml = cleanHtml.replace(/&gt;/g, '>');
    cleanHtml = cleanHtml.replace(/&quot;/g, '"');
    cleanHtml = cleanHtml.replace(/&#39;/g, "'");
    
    // Clean up whitespace
    const text = cleanHtml
      .replace(/\s+/g, ' ')
      .trim();
    
    // Count words
    const wordCount = text ? text.split(/\s+/).filter(word => word.length > 0).length : 0;
    
    return {
      text: text.substring(0, 50000), // Limit to 50k characters
      title: title.substring(0, 500), // Limit title length
      wordCount
    };
  }

  /**
   * Generate summary using local LLM (placeholder implementation)
   * This can be enhanced with actual LLM integration (Ollama, etc.)
   */
  private async generateSummary(text: string): Promise<SummaryResult> {
    // For now, return a simple extractive summary (first few sentences)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ').trim() + '.';
    
    return {
      summary: summary.substring(0, 1000), // Limit summary length
      method: 'extractive_basic',
      quality: summary.length > 50 ? 'medium' : 'low'
    };
  }

  /**
   * Process a specific article by link ID
   */
  async processArticleById(linkId: string): Promise<void> {
    const link = await this.getPendingArticleById(linkId);
    
    if (!link) {
      throw new Error(`Article link not found or already processed: ${linkId}`);
    }

    await this.processArticle(link);
  }

  /**
   * Get a specific pending article by ID
   */
  private async getPendingArticleById(linkId: string): Promise<ArticleLink | null> {
    return new Promise((resolve, reject) => {
      this.dbManager['db'].get(
        'SELECT * FROM article_links WHERE id = ? AND processed = 0',
        [linkId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row as ArticleLink || null);
        }
      );
    });
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<any> {
    const summary = await this.dbManager.getFeedProcessingSummary();
    const dailyOverview = await this.dbManager.getDailyProcessingOverview(7);
    
    return {
      feedSummary: summary,
      weeklyOverview: dailyOverview,
      isRunning: this.isRunning,
      sessionStats: {
        processed: this.processedCount,
        errors: this.errorCount
      }
    };
  }

  /**
   * Retry failed articles
   */
  async retryFailedArticles(limit: number = 20): Promise<number> {
    return new Promise((resolve, reject) => {
      this.dbManager['db'].all(
        'SELECT * FROM article_links WHERE processingStage = "failed" LIMIT ?',
        [limit],
        async (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          const failedLinks = rows as ArticleLink[];
          console.log(`🔄 Retrying ${failedLinks.length} failed articles...`);
          
          let retriedCount = 0;
          
          for (const link of failedLinks) {
            try {
              // Reset processing stage
              await this.dbManager.updateLinkProcessingStage(link.id, 'pending');
              await this.processArticle(link);
              retriedCount++;
            } catch (error) {
              console.error(`❌ Retry failed for ${link.id}: ${error instanceof Error ? error.message : error}`);
            }
          }
          
          resolve(retriedCount);
        }
      );
    });
  }

  /**
   * Get article processing queue status
   */
  async getQueueStatus(): Promise<{
    pending: number;
    extracting: number;
    summarizing: number;
    completed: number;
    failed: number;
  }> {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          processingStage,
          COUNT(*) as count
        FROM article_links 
        GROUP BY processingStage
      `;
      
      this.dbManager['db'].all(sql, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const status = {
          pending: 0,
          extracting: 0,
          summarizing: 0,
          completed: 0,
          failed: 0
        };

        rows.forEach(row => {
          if (row.processingStage in status) {
            status[row.processingStage as keyof typeof status] = row.count;
          }
        });

        resolve(status);
      });
    });
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    this.stop();
    await this.dbManager.close();
  }
}