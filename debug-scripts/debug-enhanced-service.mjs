import { EnhancedDatabaseService } from './dist/services/enhanced-database.js';

async function testEnhancedService() {
  console.log('🧪 Testing EnhancedDatabaseService...');
  
  try {
    const service = new EnhancedDatabaseService('./data/enhanced-rss.db');
    console.log('✅ Service created');
    
    // Test raw database access first
    const rawCount = await service.dbAll('SELECT COUNT(*) as count FROM feed_sources');
    console.log('✅ Raw query result:', rawCount);
    
    await service.initialize();
    console.log('✅ Service initialized');
    
    const sources = await service.getFeedSources();
    console.log(`✅ getFeedSources returned ${sources.length} sources`);
    
    if (sources.length > 0) {
      console.log('First source:', sources[0]);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testEnhancedService();