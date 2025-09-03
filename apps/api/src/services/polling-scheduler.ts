import { pollingJobRepository } from "../repositories/polling-job.js";
import { feedRepository, articleRepository } from "../repositories/index.js";
import { v4 as uuidv4 } from 'uuid';

export class PollingScheduler {
  private isRunning = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL_MS = 30000; // Check every 30 seconds
  private readonly MAX_CONCURRENT_JOBS = 3; // Limit concurrent job execution
  private activeJobs = new Set<string>();

  constructor() {
    // Bind methods to preserve context
    this.start = this.start.bind(this);
    this.stop = this.stop.bind(this);
    this.checkAndExecuteJobs = this.checkAndExecuteJobs.bind(this);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('PollingScheduler is already running');
      return;
    }

    console.log('Starting PollingScheduler...');
    this.isRunning = true;
    
    // Start the check loop
    this.checkInterval = setInterval(async () => {
      await this.checkAndExecuteJobs();
    }, this.CHECK_INTERVAL_MS);

    // Execute initial check
    await this.checkAndExecuteJobs();
    
    console.log(`PollingScheduler started (checking every ${this.CHECK_INTERVAL_MS}ms)`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('PollingScheduler is not running');
      return;
    }

    console.log('Stopping PollingScheduler...');
    this.isRunning = false;
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    // Wait for active jobs to complete (with timeout)
    const maxWaitTime = 30000; // 30 seconds
    const startTime = Date.now();
    
    while (this.activeJobs.size > 0 && (Date.now() - startTime) < maxWaitTime) {
      console.log(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      console.log(`Warning: ${this.activeJobs.size} jobs still active after timeout`);
    }

    console.log('PollingScheduler stopped');
  }

  private async checkAndExecuteJobs(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Get jobs due for execution
      const dueJobs = await pollingJobRepository.findJobsDueForExecution();
      
      if (dueJobs.length === 0) {
        return;
      }

      console.log(`Found ${dueJobs.length} jobs due for execution`);

      // Execute jobs with concurrency limit
      for (const job of dueJobs) {
        if (this.activeJobs.size >= this.MAX_CONCURRENT_JOBS) {
          console.log(`Max concurrent jobs (${this.MAX_CONCURRENT_JOBS}) reached, skipping job ${job.name}`);
          continue;
        }

        if (this.activeJobs.has(job.id)) {
          console.log(`Job ${job.name} is already running, skipping`);
          continue;
        }

        // Execute job asynchronously
        this.executeJob(job).catch(error => {
          console.error(`Error executing job ${job.name}:`, error);
        });
      }
    } catch (error) {
      console.error('Error in checkAndExecuteJobs:', error);
    }
  }

  private async executeJob(job: any): Promise<void> {
    this.activeJobs.add(job.id);
    
    try {
      console.log(`Executing polling job: ${job.name}`);
      const startTime = performance.now();
      
      const filters = JSON.parse(job.feed_filters);
      const result = await this.executePollingJobWithFilters(filters);
      const endTime = performance.now();
      
      // Update job stats
      await pollingJobRepository.updateRunStats(job.id, {
        feeds_processed: result.feedsProcessed,
        articles_found: result.articlesFound,
        execution_time_ms: endTime - startTime
      }, true);
      
      console.log(`✅ Job ${job.name} completed: ${result.feedsProcessed} feeds, ${result.articlesFound} articles`);
      
    } catch (error) {
      console.error(`❌ Job ${job.name} failed:`, error);
      
      // Update job stats for failure
      await pollingJobRepository.updateRunStats(job.id, {
        feeds_processed: 0,
        articles_found: 0,
        execution_time_ms: 0
      }, false);
    } finally {
      this.activeJobs.delete(job.id);
    }
  }

  private async executePollingJobWithFilters(filters: any): Promise<{ feedsProcessed: number; articlesFound: number }> {
    try {
      // Get feeds based on filters
      let feeds = await feedRepository.findActive();
      
      // Apply filters
      if (filters.feed_ids && filters.feed_ids.length > 0) {
        feeds = feeds.filter(feed => filters.feed_ids.includes(feed.id));
      }
      
      if (filters.categories && filters.categories.length > 0) {
        feeds = feeds.filter(feed => filters.categories.includes(feed.category));
      }
      
      if (filters.languages && filters.languages.length > 0) {
        feeds = feeds.filter(feed => filters.languages.includes(feed.language));
      }
      
      if (filters.regions && filters.regions.length > 0) {
        feeds = feeds.filter(feed => filters.regions.includes(feed.region));
      }
      
      if (filters.types && filters.types.length > 0) {
        feeds = feeds.filter(feed => filters.types.includes(feed.type));
      }

      let totalArticlesFound = 0;

      // Process each filtered feed
      for (const feed of feeds) {
        try {
          console.log(`Polling filtered feed: ${feed.name} (${feed.url})`);
          
          const feedArticles = await this.fetchAndParseRSSFeed(feed.url);
          console.log(`Found ${feedArticles.length} articles in ${feed.name}`);
          
          let newArticles = 0;
          
          for (const article of feedArticles) {
            if (!article.url || !article.title) continue;
            
            // Check if article already exists by URL
            const existing = await articleRepository.findByUrl(article.url);
            
            if (!existing) {
              // Save article immediately without LLM processing
              const articleId = uuidv4();
              await articleRepository.create({
                id: articleId,
                feed_id: feed.id,
                title: article.title,
                description: article.description || null,
                content: article.content || null,
                url: article.url,
                detected_language: null, // Will be set when user requests processing
                needs_manual_language_review: false,
                summary: null, // Will be generated when user requests processing
                original_language: null, // Will be set when user requests processing
                published_at: article.pubDate || new Date().toISOString(),
                scraped_at: new Date().toISOString(),
                created_at: new Date().toISOString()
              });
              
              newArticles++;
            }
          }
          
          totalArticlesFound += newArticles;
          
          // Update feed timestamp to track polling activity
          await feedRepository.updateLastFetched(feed.id);
          
          if (newArticles > 0) {
            console.log(`Added ${newArticles} new articles from ${feed.name}`);
          }
          
        } catch (error) {
          console.error(`Failed to poll feed ${feed.name}: ${error}`);
        }
      }
      
      return {
        feedsProcessed: feeds.length,
        articlesFound: totalArticlesFound
      };
    } catch (error) {
      throw error;
    }
  }

  private async fetchAndParseRSSFeed(feedUrl: string): Promise<Array<{
    title: string;
    url: string;
    description?: string;
    content?: string;
    pubDate?: string;
    author?: string;
    guid?: string;
  }>> {
    const Parser = (await import('rss-parser')).default;
    const parser = new Parser({
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GlobalNewsLetter/1.0)'
      },
      customFields: {
        item: [
          ['content:encoded', 'contentEncoded'],
          ['dc:creator', 'creator']
        ]
      }
    });

    try {
      const feed = await parser.parseURL(feedUrl);
      
      return feed.items.map(item => ({
        title: item.title || 'Untitled',
        url: item.link || item.guid || '',
        description: item.contentSnippet || item.summary,
        content: (item as any).contentEncoded || item.content,
        pubDate: item.pubDate || item.isoDate,
        author: item.creator || (item as any).author,
        guid: item.guid
      }));
    } catch (error) {
      throw new Error(`Failed to parse RSS feed ${feedUrl}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeJobsCount: this.activeJobs.size,
      maxConcurrentJobs: this.MAX_CONCURRENT_JOBS,
      checkIntervalMs: this.CHECK_INTERVAL_MS
    };
  }
}

// Export singleton instance
export const pollingScheduler = new PollingScheduler();