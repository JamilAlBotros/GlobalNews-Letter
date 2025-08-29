import { EnhancedDatabaseService } from './src/services/enhanced-database.js';

async function debugApiDatabase() {
  console.log('🔧 Debug: Testing API database connection...');
  
  try {
    // Test with hardcoded path like the API
    const db = new EnhancedDatabaseService('./data/enhanced-rss.db');
    await db.initialize();
    
    console.log('✅ Database initialized successfully');
    
    // Test the exact same call the API makes
    const sources = await db.getFeedSources();
    console.log(`📊 db.getFeedSources() returned ${sources.length} sources`);
    
    if (sources.length > 0) {
      console.log('📝 Sample source:', {
        id: sources[0].id,
        name: sources[0].name,
        language: sources[0].source_language,
        category: sources[0].content_category
      });
    } else {
      console.log('🔍 Let\'s check what\'s in the database directly...');
      
      // Direct SQL query to debug
      const allRows = await (db as any).dbAll('SELECT COUNT(*) as count FROM feed_sources');
      console.log('📊 Direct SQL COUNT result:', allRows);
      
      const sampleRows = await (db as any).dbAll('SELECT id, name, source_language FROM feed_sources LIMIT 3');
      console.log('📋 Sample rows from SQL:', sampleRows);
    }
    
    await db.close();
  } catch (error) {
    console.error('💥 Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

debugApiDatabase();