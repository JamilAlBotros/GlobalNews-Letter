import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('data/enhanced-rss.db');

db.get("SELECT COUNT(*) as count FROM feed_sources", [], (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Feed sources count:', row.count);
  }
});

db.get("SELECT COUNT(*) as count FROM feed_instances", [], (err, row) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Feed instances count:', row.count);
  }
});

db.all("SELECT id, name, source_language, content_category FROM feed_sources LIMIT 5", [], (err, rows) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Sample feed sources:');
    rows.forEach(row => {
      console.log(`- ${row.name} (${row.source_language}, ${row.content_category})`);
    });
  }
});

db.close();