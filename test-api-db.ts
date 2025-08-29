import { EnhancedDatabaseService } from './src/services/enhanced-database.js';

async function testApiDatabase() {
  console.log('🧪 Testing API database connection...');
  
  try {
    const db = new EnhancedDatabaseService();
    await db.initialize();
    
    console.log('✅ Database initialized');
    
    const sources = await db.getFeedSources();
    console.log(`📊 Found ${sources.length} feed sources`);
    
    if (sources.length > 0) {
      console.log('📝 First 3 sources:');
      sources.slice(0, 3).forEach((source, i) => {
        console.log(`  ${i + 1}. ${source.name} (${source.source_language}, ${source.content_category})`);
      });
    }
    
    await db.close();
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

testApiDatabase();