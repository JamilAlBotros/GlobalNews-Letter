#!/usr/bin/env node

import { readFileSync } from 'fs';
import { z } from 'zod';

const CsvRowSchema = z.object({
  rss_url: z.string().url(),
  source_language: z.string(),
  primary_region: z.string().optional(),
  content_category: z.string(),
  content_type: z.string()
});

type CsvRow = z.infer<typeof CsvRowSchema>;

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
      throw new Error(`Invalid row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function makeRequestWithRetry(url: string, options: RequestInit, maxRetries: number = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        if (attempt === maxRetries) {
          throw new Error(`Rate limited after ${maxRetries} attempts`);
        }
        console.log(`⏳ Rate limited, waiting ${attempt * 2} seconds before retry ${attempt + 1}/${maxRetries}...`);
        await delay(attempt * 2000); // Exponential backoff: 2s, 4s, 6s
        continue;
      }
      
      return response;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`⏳ Request failed, retrying in ${attempt} seconds...`);
      await delay(attempt * 1000);
    }
  }
  throw new Error('Max retries exceeded');
}

async function uploadFeeds(csvPath: string): Promise<void> {
  console.log(`📊 Reading CSV file: ${csvPath}`);
  
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCsv(csvContent);
  
  console.log(`✅ Parsed ${rows.length} RSS feeds`);
  
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;
  
  const API_BASE_URL = 'http://localhost:3333';
  
  for (const [index, row] of rows.entries()) {
    try {
      console.log(`📝 Processing ${index + 1}/${rows.length}: ${row.rss_url}`);
      
      const sourceName = generateSourceName(row.rss_url);
      
      const feedData = {
        name: sourceName,
        url: row.rss_url,
        language: row.source_language,
        region: row.primary_region || 'Global',
        category: row.content_category,
        type: row.content_type,
        is_active: true
      };
      
      const response = await makeRequestWithRetry(`${API_BASE_URL}/feeds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedData)
      });
      
      if (!response.ok) {
        if (response.status === 409) {
          skipCount++;
          console.log(`⏭️  Skipped (already exists): ${sourceName}`);
          continue;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      successCount++;
      console.log(`✅ [${successCount}/${rows.length}] Added: ${sourceName} (ID: ${result.id})`);
      
      // Add delay to avoid rate limiting
      await delay(100);
      
    } catch (error) {
      errorCount++;
      console.error(`❌ Failed to process ${row.rss_url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Add delay even on errors to avoid overwhelming the API
      await delay(100);
    }
  }
  
  console.log(`\n📊 Upload Summary:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skipCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);
}

async function main() {
  console.log('🚀 Starting RSS feed upload...');
  
  const csvPath = process.argv[2];
  
  if (!csvPath) {
    console.error('Usage: tsx scripts/upload-feeds.ts <csv-file-path>');
    console.error('Example: tsx scripts/upload-feeds.ts temp/sample_enriched_data.csv');
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

main().catch(console.error);