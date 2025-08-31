#!/usr/bin/env node

import { ArticleProcessor } from '../services/article-processor.js';
import { GoogleRSSDatabaseManager } from '../database/google-rss-schema.js';
import path from 'path';

/**
 * Article Processing CLI
 * Command-line interface for processing articles through the extraction → summarization pipeline
 */

const DB_PATH = path.join(process.cwd(), 'data', 'google-rss.db');

interface CliOptions {
  batchSize?: number;
  interval?: number;
  linkId?: string;
  limit?: number;
  retry?: boolean;
  showDetails?: boolean;
}

let processor: ArticleProcessor | null = null;
let dbManager: GoogleRSSDatabaseManager | null = null;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  try {
    processor = new ArticleProcessor(DB_PATH);
    await processor.initialize();

    dbManager = new GoogleRSSDatabaseManager(DB_PATH);
    await dbManager.initialize();

    const options = parseOptions(args.slice(1));

    switch (command) {
      case 'start':
        await startContinuousProcessing(options);
        break;
        
      case 'batch':
        await processBatch(options);
        break;
        
      case 'article':
        await processSingleArticle(options);
        break;
        
      case 'status':
        await showProcessingStatus(options);
        break;
        
      case 'queue':
        await showQueue(options);
        break;
        
      case 'retry':
        await retryFailedArticles(options);
        break;
        
      case 'results':
        await showProcessedArticles(options);
        break;
        
      case 'stats':
        await showDetailedStats(options);
        break;
        
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (processor) await processor.close();
    if (dbManager) await dbManager.close();
  }
}

function parseOptions(args: string[]): CliOptions {
  const options: CliOptions = {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    
    if (arg.startsWith('--batch=')) {
      const batchStr = arg.split('=')[1];
      if (batchStr) {
        options.batchSize = parseInt(batchStr);
      }
    } else if (arg.startsWith('--interval=')) {
      const intervalStr = arg.split('=')[1];
      if (intervalStr) {
        options.interval = parseInt(intervalStr);
      }
    } else if (arg.startsWith('--link=')) {
      const linkStr = arg.split('=')[1];
      if (linkStr) {
        options.linkId = linkStr;
      }
    } else if (arg.startsWith('--limit=')) {
      const limitStr = arg.split('=')[1];
      if (limitStr) {
        options.limit = parseInt(limitStr);
      }
    } else if (arg === '--retry') {
      options.retry = true;
    } else if (arg === '--details') {
      options.showDetails = true;
    } else if (!arg.startsWith('-') && !options.linkId) {
      options.linkId = arg;
    }
  }
  
  return options;
}

async function startContinuousProcessing(options: CliOptions): Promise<void> {
  const batchSize = options.batchSize || 10;
  const interval = options.interval || 5;
  
  console.log('⚙️ Article Processing Pipeline');
  console.log('=============================');
  console.log(`📊 Batch size: ${batchSize} articles`);
  console.log(`⏰ Processing interval: ${interval} minutes`);
  console.log(`💾 Database: ${DB_PATH}\n`);

  // Show current queue status
  const queueStatus = await processor!.getQueueStatus();
  console.log('📝 Current Queue Status:');
  console.log(`   Pending: ${queueStatus.pending}`);
  console.log(`   Processing: ${queueStatus.extracting + queueStatus.summarizing}`);
  console.log(`   Completed: ${queueStatus.completed}`);
  console.log(`   Failed: ${queueStatus.failed}\n`);

  if (queueStatus.pending === 0) {
    console.log('ℹ️  No articles in processing queue.');
    console.log('💡 Add articles by running the scraper: npm run scraper once');
    return;
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    if (processor) {
      await processor.close();
    }
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Received termination signal, shutting down...');
    if (processor) {
      await processor.close();
    }
    process.exit(0);
  });

  await processor!.startContinuousProcessing(batchSize, interval);
  
  // Keep the process running
  process.stdin.resume();
}

async function processBatch(options: CliOptions): Promise<void> {
  const batchSize = options.batchSize || 20;
  
  console.log(`⚙️ Processing batch of ${batchSize} articles...\n`);
  
  const processed = await processor!.processBatch(batchSize);
  
  console.log(`\n✅ Batch processing completed. Processed ${processed} articles.`);
  
  if (processed === 0) {
    console.log('ℹ️  No pending articles found.');
    console.log('💡 Check queue status with: npm run process queue');
  }
}

async function processSingleArticle(options: CliOptions): Promise<void> {
  if (!options.linkId) {
    console.error('❌ Article link ID required');
    console.log('Usage: npm run process article <link-id>');
    return;
  }

  console.log(`⚙️ Processing single article: ${options.linkId}\n`);
  
  try {
    await processor!.processArticleById(options.linkId);
    console.log('\n✅ Article processing completed successfully');
  } catch (error) {
    console.error(`❌ Failed to process article: ${error instanceof Error ? error.message : error}`);
  }
}

async function showProcessingStatus(options: CliOptions): Promise<void> {
  console.log('📊 Article Processing Status');
  console.log('===========================\n');

  const stats = await processor!.getProcessingStats();
  const queueStatus = await processor!.getQueueStatus();
  
  console.log(`🔄 Processor running: ${stats.isRunning ? 'YES' : 'NO'}\n`);
  
  // Queue status
  console.log('📝 PROCESSING QUEUE');
  console.log('-'.repeat(30));
  console.log(`Pending articles: ${queueStatus.pending}`);
  console.log(`Currently extracting: ${queueStatus.extracting}`);
  console.log(`Currently summarizing: ${queueStatus.summarizing}`);
  console.log(`Completed articles: ${queueStatus.completed}`);
  console.log(`Failed articles: ${queueStatus.failed}`);
  
  const totalProcessed = queueStatus.completed + queueStatus.failed;
  const totalArticles = Object.values(queueStatus).reduce((sum, count) => sum + count, 0);
  const completionRate = totalArticles > 0 ? ((totalProcessed / totalArticles) * 100).toFixed(1) : '0.0';
  
  console.log(`\n📈 Overall completion rate: ${completionRate}%`);

  // Session stats (if processor is running)
  if (stats.sessionStats) {
    console.log('\n🎯 SESSION STATISTICS');
    console.log('-'.repeat(30));
    console.log(`Articles processed: ${stats.sessionStats.processed}`);
    console.log(`Processing errors: ${stats.sessionStats.errors}`);
  }

  // Processing recommendations
  console.log('\n💡 RECOMMENDATIONS');
  console.log('-'.repeat(30));
  
  if (queueStatus.pending > 0) {
    console.log(`• Process ${queueStatus.pending} pending articles: npm run process batch --batch=${Math.min(queueStatus.pending, 50)}`);
  }
  
  if (queueStatus.failed > 0) {
    console.log(`• Retry ${queueStatus.failed} failed articles: npm run process retry --limit=${queueStatus.failed}`);
  }
  
  if (queueStatus.pending === 0 && queueStatus.failed === 0) {
    console.log('• All articles processed! Add more with: npm run scraper once');
  }
}

async function showQueue(options: CliOptions): Promise<void> {
  const limit = options.limit || 20;
  
  console.log(`📋 Processing Queue (showing up to ${limit} items)`);
  console.log('='.repeat(50 + limit.toString().length));

  const pendingLinks = await processor!['dbManager'].getPendingLinks(limit);
  
  if (pendingLinks.length === 0) {
    console.log('✅ Processing queue is empty!');
    console.log('\n💡 Add more articles by running:');
    console.log('   npm run scraper once');
    return;
  }

  console.log(`Found ${pendingLinks.length} articles in queue:\n`);
  
  pendingLinks.forEach((link, index) => {
    const scrapedDate = new Date(link.scrapedAt).toLocaleDateString();
    const stageEmoji = getProcessingStageEmoji(link.processingStage);
    
    console.log(`${index + 1}. ${link.title}`);
    console.log(`   🔗 ${link.link}`);
    console.log(`   📅 Scraped: ${scrapedDate} | ${stageEmoji} ${link.processingStage}`);
    if (link.errorMessage) {
      console.log(`   ❌ Error: ${link.errorMessage}`);
    }
    console.log(`   🆔 ID: ${link.id}\n`);
  });
  
  console.log(`💡 Process these articles with:`);
  console.log(`   npm run process batch --batch=${Math.min(pendingLinks.length, 20)}`);
}

async function retryFailedArticles(options: CliOptions): Promise<void> {
  const limit = options.limit || 10;
  
  console.log(`🔄 Retrying failed article processing (up to ${limit} articles)...\n`);
  
  try {
    const retried = await processor!.retryFailedArticles(limit);
    
    if (retried === 0) {
      console.log('ℹ️  No failed articles found to retry');
    } else {
      console.log(`✅ Successfully retried ${retried} articles`);
    }
  } catch (error) {
    console.error(`❌ Retry operation failed: ${error instanceof Error ? error.message : error}`);
  }
}

async function showProcessedArticles(options: CliOptions): Promise<void> {
  const limit = options.limit || 20;
  
  console.log(`📰 Processed Articles (showing last ${limit})`);
  console.log('='.repeat(40 + limit.toString().length));

  const articles = await dbManager!.getProcessedArticles(undefined, limit);
  
  if (articles.length === 0) {
    console.log('📭 No processed articles found');
    console.log('\n💡 Process articles with: npm run process batch');
    return;
  }

  console.log(`Found ${articles.length} processed articles:\n`);
  
  articles.forEach((article, index) => {
    const processedDate = new Date(article.processedAt).toLocaleDateString();
    const qualityEmoji = getQualityEmoji(article.quality);
    
    console.log(`${index + 1}. ${article.title}`);
    console.log(`   🔗 ${article.originalUrl}`);
    console.log(`   ${qualityEmoji} Quality: ${article.quality} | Words: ${article.wordCount || 'N/A'}`);
    console.log(`   ⚙️ Extraction: ${article.extractionMethod}${article.summaryMethod ? ` | Summary: ${article.summaryMethod}` : ''}`);
    console.log(`   📅 Processed: ${processedDate}`);
    
    if (options.showDetails && article.summary) {
      console.log(`   📝 Summary: ${article.summary.substring(0, 150)}...`);
    }
    
    console.log(`   🆔 ID: ${article.id}\n`);
  });
  
  // Quality distribution
  const qualityDistribution = articles.reduce((acc, article) => {
    acc[article.quality] = (acc[article.quality] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('📊 QUALITY DISTRIBUTION');
  Object.entries(qualityDistribution).forEach(([quality, count]) => {
    const emoji = getQualityEmoji(quality as any);
    console.log(`   ${emoji} ${quality}: ${count} articles`);
  });
}

async function showDetailedStats(options: CliOptions): Promise<void> {
  console.log('📈 Detailed Processing Statistics');
  console.log('================================\n');

  const stats = await processor!.getProcessingStats();
  const queueStatus = await processor!.getQueueStatus();
  
  // Overall processing metrics
  const totalArticles = Object.values(queueStatus).reduce((sum, count) => sum + count, 0);
  const completionRate = totalArticles > 0 ? ((queueStatus.completed / totalArticles) * 100).toFixed(1) : '0.0';
  const failureRate = totalArticles > 0 ? ((queueStatus.failed / totalArticles) * 100).toFixed(1) : '0.0';

  console.log('📊 PROCESSING METRICS');
  console.log(`Total articles: ${totalArticles}`);
  console.log(`Completion rate: ${completionRate}%`);
  console.log(`Failure rate: ${failureRate}%`);
  console.log(`Currently processing: ${queueStatus.extracting + queueStatus.summarizing}`);
  
  // Feed-specific statistics
  if (stats.feedSummary && stats.feedSummary.length > 0) {
    console.log('\n📡 FEED PROCESSING SUMMARY');
    console.log('-'.repeat(80));
    console.log('Feed'.padEnd(25) + 'Links'.padEnd(8) + 'Completed'.padEnd(12) + 'High Quality'.padEnd(14) + 'Avg Words');
    console.log('-'.repeat(80));
    
    stats.feedSummary.forEach((feed: any) => {
      const avgWords = feed.avgWordCount ? Math.round(feed.avgWordCount) : 'N/A';
      console.log(
        (feed.name || '').substring(0, 24).padEnd(25) +
        (feed.totalLinks || 0).toString().padEnd(8) +
        (feed.completedArticles || 0).toString().padEnd(12) +
        (feed.highQualityArticles || 0).toString().padEnd(14) +
        avgWords
      );
    });
  }

  // Recent processing activity
  if (stats.weeklyOverview && stats.weeklyOverview.length > 0) {
    console.log('\n📅 RECENT PROCESSING ACTIVITY (Last 7 Days)');
    console.log('-'.repeat(70));
    console.log('Date'.padEnd(12) + 'Extracted'.padEnd(12) + 'Summarized'.padEnd(12) + 'Errors'.padEnd(8) + 'Extract Time'.padEnd(14) + 'Summary Time');
    console.log('-'.repeat(70));
    
    stats.weeklyOverview.forEach((day: any) => {
      const extractTime = day.avgExtractionTime ? `${day.avgExtractionTime.toFixed(1)}s` : 'N/A';
      const summaryTime = day.avgSummaryTime ? `${day.avgSummaryTime.toFixed(1)}s` : 'N/A';
      
      console.log(
        (day.date || '').padEnd(12) +
        (day.totalExtracted || 0).toString().padEnd(12) +
        (day.totalSummarized || 0).toString().padEnd(12) +
        (day.totalErrors || 0).toString().padEnd(8) +
        extractTime.padEnd(14) +
        summaryTime
      );
    });
  }

  // Performance insights
  console.log('\n💡 PERFORMANCE INSIGHTS');
  console.log('-'.repeat(30));
  
  if (queueStatus.failed > queueStatus.completed * 0.1) {
    console.log('⚠️ High failure rate detected. Consider checking extraction methods.');
  }
  
  if (queueStatus.pending > 100) {
    console.log('📈 Large processing queue. Consider increasing batch size or running continuous processing.');
  }
  
  if (queueStatus.completed > 0 && queueStatus.failed === 0) {
    console.log('✅ Excellent processing success rate!');
  }

  // Processing recommendations
  console.log('\n🎯 NEXT STEPS');
  console.log('-'.repeat(15));
  
  if (queueStatus.pending > 0) {
    console.log('• Process pending articles: npm run process batch');
  }
  
  if (queueStatus.failed > 0) {
    console.log('• Retry failed articles: npm run process retry');
  }
  
  if (queueStatus.completed > 20) {
    console.log('• View processed articles: npm run process results --details');
  }
}

function getProcessingStageEmoji(stage: string): string {
  switch (stage) {
    case 'pending': return '⏳';
    case 'extracting': return '📝';
    case 'summarizing': return '✍️';
    case 'completed': return '✅';
    case 'failed': return '❌';
    default: return '❓';
  }
}

function getQualityEmoji(quality: string): string {
  switch (quality) {
    case 'high': return '🟢';
    case 'medium': return '🟡';
    case 'low': return '🟠';
    case 'failed': return '🔴';
    default: return '⚪';
  }
}

function showHelp(): void {
  console.log('⚙️ Article Processing CLI');
  console.log('=========================\n');
  
  console.log('COMMANDS:');
  console.log('  start                 Start continuous article processing');
  console.log('  batch                 Process a batch of pending articles');
  console.log('  article <link-id>     Process a specific article by link ID');
  console.log('  status                Show current processing status');
  console.log('  queue                 Show articles in processing queue');
  console.log('  retry                 Retry failed article processing');
  console.log('  results               Show processed articles');
  console.log('  stats                 Show detailed processing statistics');
  console.log('  help                  Show this help message\n');
  
  console.log('OPTIONS:');
  console.log('  --batch=<size>        Batch size for processing (default varies by command)');
  console.log('  --interval=<minutes>  Processing interval for continuous mode (default: 5)');
  console.log('  --link=<id>          Specify article link ID');
  console.log('  --limit=<number>     Limit number of results shown');
  console.log('  --retry               Include retry operations');
  console.log('  --details             Show additional details in output\n');
  
  console.log('EXAMPLES:');
  console.log('  npm run process start --batch=20 --interval=10    # Continuous processing');
  console.log('  npm run process batch --batch=50                  # Process 50 articles');
  console.log('  npm run process article abc123def456              # Process specific article');
  console.log('  npm run process queue --limit=30                  # Show 30 queue items');
  console.log('  npm run process retry --limit=10                  # Retry 10 failed articles');
  console.log('  npm run process results --limit=25 --details      # Show 25 results with details');
  console.log('  npm run process stats                             # Detailed statistics\n');
  
  console.log('💡 TYPICAL WORKFLOW:');
  console.log('1. Add RSS feeds: npm run google-rss');
  console.log('2. Scrape articles: npm run scraper once');
  console.log('3. Process articles: npm run process batch');
  console.log('4. Monitor progress: npm run process status');
  console.log('5. View results: npm run process results');
}

// Run main function
main().catch(console.error);