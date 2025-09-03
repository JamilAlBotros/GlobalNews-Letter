import { getDatabase, closeDatabase } from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  console.log('Starting PostgreSQL database migrations...');
  
  try {
    const db = getDatabase();
    const migrationsPath = path.join(__dirname, 'migrations');
    
    // Read migration files
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const migrationSQL = fs.readFileSync(path.join(migrationsPath, file), 'utf8');
      await db.exec(migrationSQL);
      console.log(`✅ Completed migration: ${file}`);
    }
    
    console.log('✅ All database migrations completed successfully!');
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    await closeDatabase();
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}