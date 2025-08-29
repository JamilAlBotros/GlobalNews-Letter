import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('./data/enhanced-rss.db');

console.log('🧪 Testing database directly...');

db.get("SELECT COUNT(*) as count FROM feed_sources", [], (err, row) => {
  if (err) {
    console.error('❌ Error:', err.message);
  } else {
    console.log(`✅ Feed sources count: ${row.count}`);
  }
});

db.all("SELECT id, name, source_language, content_category FROM feed_sources LIMIT 3", [], (err, rows) => {
  if (err) {
    console.error('❌ Error:', err.message);
  } else {
    console.log('📋 First 3 feed sources:');
    rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.name} (${row.source_language}, ${row.content_category})`);
    });
  }
  
  db.close(() => {
    console.log('🔚 Database connection closed');
  });
});