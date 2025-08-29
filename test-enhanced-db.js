const { EnhancedDatabaseService } = require('./dist/services/enhanced-database.js');

async function testDatabase() {
  console.log('🧪 Testing enhanced database service...');
  
  try {
    const db = new EnhancedDatabaseService('./data/enhanced-rss.db');
    console.log('✅ Database service created');
    
    await db.initialize();
    console.log('✅ Database initialized');
    
    const sources = await db.getFeedSources();
    console.log(`✅ Found ${sources.length} feed sources`);
    
    if (sources.length > 0) {
      console.log('📊 First source:', JSON.stringify(sources[0], null, 2));
    }
    
    console.log('✅ Test completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDatabase();