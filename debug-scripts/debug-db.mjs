import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./data/enhanced-rss.db');

// Check if we can directly query the database
db.all('SELECT COUNT(*) as count FROM feed_sources', (err, rows) => {
  if (err) {
    console.error('❌ Direct query error:', err);
    return;
  }
  console.log('✅ Direct query result:', rows[0].count, 'sources');
  
  // Get a sample record
  db.all('SELECT * FROM feed_sources LIMIT 3', (err, samples) => {
    if (err) {
      console.error('❌ Sample query error:', err);
      return;
    }
    console.log('✅ Sample sources:');
    samples.forEach((source, i) => {
      console.log(`${i + 1}.`, {
        id: source.id,
        name: source.name,
        source_language: source.source_language,
        is_active: source.is_active
      });
    });
    
    db.close();
  });
});