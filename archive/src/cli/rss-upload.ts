#!/usr/bin/env node

import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { EnhancedDatabaseService } from '../services/enhanced-database.js';

const CsvRowSchema = z.object({
  rss_url: z.string().url(),
  source_language: z.string(),
  primary_region: z.string().optional(),
  content_category: z.string(),
  content_type: z.string()
});

type CsvRow = z.infer<typeof CsvRowSchema>;

const LANGUAGE_MAP: Record<string, string> = {
  'English': 'en',
  'Spanish': 'es', 
  'Arabic': 'ar',
  'Portuguese': 'pt',
  'French': 'fr',
  'Chinese': 'zh',
  'Japanese': 'ja'
};

const CATEGORY_MAP: Record<string, string> = {
  'News': 'general',
  'Technology': 'tech',
  'Finance': 'finance',
  'Business': 'finance',
  'Health': 'health',
  'Science': 'tech',
  'Sports': 'general',
  'Entertainment': 'general',
  'Politics': 'general',
  'Lifestyle': 'general',
  'Gaming': 'tech',
  'Crypto': 'finance',
  'Education': 'general',
  'Travel': 'general'
};

const TYPE_MAP: Record<string, string> = {
  'News': 'daily',
  'Analysis': 'analysis', 
  'Blog': 'daily',
  'Tutorial': 'daily',
  'Recipe': 'daily',
  'Review': 'daily',
  'Research': 'analysis'
};

function parseCsv(content: string): CsvRow[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map((line, index) => {
    const values = line.split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, i) => {
      row[header] = values[i] || '';
    });
    
    try {
      return CsvRowSchema.parse(row);
    } catch (error) {
      throw new Error(`Invalid row ${index + 2}: ${error.message}`);
    }
  });
}

function generateSourceName(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace('www.', '');
    const parts = hostname.split('.');
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  } catch {
    return 'Unknown Source';
  }
}

async function uploadFeeds(csvPath: string): Promise<void> {
  console.log(`📊 Reading CSV file: ${csvPath}`);
  
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(csvContent);
  
  console.log(`✅ Parsed ${rows.length} RSS feeds`);
  
  console.log(`🗄️ Initializing database...`);
  const db = new EnhancedDatabaseService('./data/enhanced-rss.db');
  await db.initialize();
  console.log(`✅ Database initialized successfully`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  for (const [index, row] of rows.entries()) {
    try {
      console.log(`📝 Processing ${index + 1}/${rows.length}: ${row.rss_url}`);
      const sourceId = uuidv4();
      const instanceId = uuidv4();
      
      const sourceLang = LANGUAGE_MAP[row.source_language] || 'en';
      const category = CATEGORY_MAP[row.content_category] || 'general';
      const contentType = TYPE_MAP[row.content_type] || 'daily';
      
      const sourceName = generateSourceName(row.rss_url);
      
      // Create feed source
      await db.saveFeedSource({
        id: sourceId,
        name: sourceName,
        base_url: new URL(row.rss_url).origin,
        provider_type: 'rss',
        source_language: sourceLang as any,
        primary_region: row.primary_region,
        content_category: category as any,
        content_type: contentType as any,
        is_active: true,
        quality_score: 0.5
      });
      
      // Create feed instance
      await db.saveFeedInstance({
        id: instanceId,
        source_id: sourceId,
        instance_name: `${sourceName} RSS`,
        feed_url: row.rss_url,
        refresh_tier: 'standard',
        base_refresh_minutes: 60,
        adaptive_refresh: true,
        consecutive_failures: 0,
        avg_articles_per_fetch: 0,
        reliability_score: 1.0,
        is_active: true
      });
      
      successCount++;
      console.log(`✅ [${successCount}/${rows.length}] Added: ${sourceName} (${sourceLang})`);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to process ${row.rss_url}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);
  
  await db.close();
}

async function main() {
  console.log('🚀 Starting RSS feed upload...');
  console.log('Args:', process.argv);
  
  const csvPath = process.argv[2];
  
  if (!csvPath) {
    console.error('Usage: npm run rss-upload <csv-file-path>');
    console.error('Example: npm run rss-upload sample_enriched_data.csv');
    process.exit(1);
  }
  
  try {
    await uploadFeeds(csvPath);
    console.log('🎉 RSS feed upload completed!');
  } catch (error) {
    console.error('💥 Upload failed:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Stack trace:', error instanceof Error ? error.stack : '');
    process.exit(1);
  }
}

// Run immediately
main().catch(console.error);