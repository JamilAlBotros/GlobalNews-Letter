#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Database Backup and Restore Utility
 * Handles backup, restore, and cleanup operations for all database files
 */

interface BackupOptions {
  includeData?: boolean;
  compress?: boolean;
  outputDir?: string;
}

interface RestoreOptions {
  backupFile: string;
  force?: boolean;
}

class DatabaseBackupManager {
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly backupDir = path.join(process.cwd(), 'backups');
  
  private readonly dbFiles = [
    'news.db',           // Legacy database
    'enhanced-rss.db',   // Main enhanced database  
    'google-rss.db'      // Google RSS database
  ];

  constructor() {
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  /**
   * Create a backup of all databases
   */
  async createBackup(options: BackupOptions = {}): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `globalnews-backup-${timestamp}`;
    const backupPath = path.join(options.outputDir || this.backupDir, backupName);

    console.log('📦 Creating database backup...');
    console.log(`📁 Backup location: ${backupPath}`);

    // Create backup directory
    fs.mkdirSync(backupPath, { recursive: true });

    let backedUpFiles = 0;
    let totalSize = 0;

    // Backup each database file
    for (const dbFile of this.dbFiles) {
      const sourcePath = path.join(this.dataDir, dbFile);
      const backupFilePath = path.join(backupPath, dbFile);

      if (fs.existsSync(sourcePath)) {
        try {
          // Copy database file
          fs.copyFileSync(sourcePath, backupFilePath);
          
          const stats = fs.statSync(backupFilePath);
          totalSize += stats.size;
          backedUpFiles++;
          
          console.log(`✅ Backed up ${dbFile} (${this.formatBytes(stats.size)})`);
          
          // Create SQLite dump if requested
          if (options.includeData) {
            await this.createSqlDump(sourcePath, path.join(backupPath, `${dbFile}.sql`));
            console.log(`📄 Created SQL dump for ${dbFile}`);
          }
        } catch (error) {
          console.error(`❌ Failed to backup ${dbFile}:`, error);
        }
      } else {
        console.log(`⚠️ Database file not found: ${dbFile}`);
      }
    }

    // Create backup manifest
    const manifest = {
      created_at: new Date().toISOString(),
      version: '1.0.0',
      files: this.dbFiles.filter(file => fs.existsSync(path.join(this.dataDir, file))),
      total_size: totalSize,
      options: options
    };

    fs.writeFileSync(
      path.join(backupPath, 'backup-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Compress if requested
    if (options.compress) {
      const archivePath = `${backupPath}.tar.gz`;
      await this.compressBackup(backupPath, archivePath);
      
      // Remove uncompressed backup directory
      fs.rmSync(backupPath, { recursive: true });
      
      console.log(`🗜️ Compressed backup: ${archivePath}`);
      return archivePath;
    }

    console.log(`\n🎉 Backup completed successfully!`);
    console.log(`📊 Files backed up: ${backedUpFiles}`);
    console.log(`📈 Total size: ${this.formatBytes(totalSize)}`);
    console.log(`📍 Location: ${backupPath}`);

    return backupPath;
  }

  /**
   * List available backups
   */
  listBackups(): Array<{
    name: string;
    path: string;
    created: Date;
    size: number;
    compressed: boolean;
  }> {
    const backups: Array<any> = [];

    if (!fs.existsSync(this.backupDir)) {
      return backups;
    }

    const entries = fs.readdirSync(this.backupDir);

    for (const entry of entries) {
      const entryPath = path.join(this.backupDir, entry);
      const stats = fs.statSync(entryPath);
      
      if (entry.startsWith('globalnews-backup-')) {
        const isCompressed = entry.endsWith('.tar.gz');
        const manifestPath = isCompressed 
          ? null 
          : path.join(entryPath, 'backup-manifest.json');
        
        let created = stats.birthtime;
        
        // Try to get creation time from manifest
        if (manifestPath && fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            created = new Date(manifest.created_at);
          } catch (error) {
            // Use file stats as fallback
          }
        }

        backups.push({
          name: entry,
          path: entryPath,
          created: created,
          size: stats.size,
          compressed: isCompressed
        });
      }
    }

    return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    const { backupFile, force = false } = options;
    
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }

    console.log('🔄 Restoring from backup...');
    console.log(`📁 Source: ${backupFile}`);

    // Check if current databases exist
    if (!force) {
      const existingDbs = this.dbFiles.filter(file => 
        fs.existsSync(path.join(this.dataDir, file))
      );
      
      if (existingDbs.length > 0) {
        console.log('⚠️ Existing databases found:');
        existingDbs.forEach(db => console.log(`   - ${db}`));
        console.log('\nUse --force to overwrite existing databases');
        throw new Error('Databases already exist. Use --force to overwrite.');
      }
    }

    // Handle compressed backup
    let backupPath = backupFile;
    let shouldCleanup = false;

    if (backupFile.endsWith('.tar.gz')) {
      console.log('🗜️ Extracting compressed backup...');
      const extractPath = path.join(this.backupDir, 'temp-restore');
      await this.extractBackup(backupFile, extractPath);
      backupPath = extractPath;
      shouldCleanup = true;
    }

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    let restoredFiles = 0;

    // Restore each database file
    for (const dbFile of this.dbFiles) {
      const sourcePath = path.join(backupPath, dbFile);
      const targetPath = path.join(this.dataDir, dbFile);

      if (fs.existsSync(sourcePath)) {
        try {
          fs.copyFileSync(sourcePath, targetPath);
          const stats = fs.statSync(targetPath);
          console.log(`✅ Restored ${dbFile} (${this.formatBytes(stats.size)})`);
          restoredFiles++;
        } catch (error) {
          console.error(`❌ Failed to restore ${dbFile}:`, error);
        }
      }
    }

    // Cleanup temporary extraction
    if (shouldCleanup) {
      fs.rmSync(backupPath, { recursive: true, force: true });
    }

    console.log(`\n🎉 Restore completed successfully!`);
    console.log(`📊 Files restored: ${restoredFiles}`);
  }

  /**
   * Wipe all databases (with confirmation)
   */
  async wipeDatabase(force: boolean = false): Promise<void> {
    if (!force) {
      console.log('⚠️ WARNING: This will permanently delete all database files!');
      console.log('📋 Files that will be deleted:');
      
      const existingFiles = this.dbFiles.filter(file => 
        fs.existsSync(path.join(this.dataDir, file))
      );
      
      if (existingFiles.length === 0) {
        console.log('ℹ️ No database files found to delete.');
        return;
      }

      existingFiles.forEach(file => {
        const filePath = path.join(this.dataDir, file);
        const stats = fs.statSync(filePath);
        console.log(`   - ${file} (${this.formatBytes(stats.size)})`);
      });

      console.log('\n❌ Use --force flag to confirm deletion');
      console.log('   npm run db:wipe -- --force');
      return;
    }

    console.log('🗑️ Wiping database files...');

    let deletedFiles = 0;
    for (const dbFile of this.dbFiles) {
      const filePath = path.join(this.dataDir, dbFile);
      
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log(`✅ Deleted ${dbFile}`);
          deletedFiles++;
        } catch (error) {
          console.error(`❌ Failed to delete ${dbFile}:`, error);
        }
      }
    }

    // Also clean up any journal/wal files
    const cleanupPatterns = ['-journal', '-wal', '-shm'];
    for (const dbFile of this.dbFiles) {
      for (const pattern of cleanupPatterns) {
        const cleanupFile = path.join(this.dataDir, `${dbFile}${pattern}`);
        if (fs.existsSync(cleanupFile)) {
          try {
            fs.unlinkSync(cleanupFile);
            console.log(`🧹 Cleaned up ${dbFile}${pattern}`);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    }

    console.log(`\n🎉 Database wipe completed!`);
    console.log(`📊 Files deleted: ${deletedFiles}`);
    console.log('\n💡 To recreate databases with sample data:');
    console.log('   npm run db:init');
  }

  /**
   * Auto-backup before dangerous operations
   */
  async createAutoBackup(): Promise<string> {
    console.log('🔒 Creating automatic backup before operation...');
    
    const backupPath = await this.createBackup({
      outputDir: path.join(this.backupDir, 'auto'),
      compress: true
    });

    console.log('✅ Auto-backup created for safety\n');
    return backupPath;
  }

  // Private helper methods

  private async createSqlDump(dbPath: string, outputPath: string): Promise<void> {
    try {
      const command = `sqlite3 "${dbPath}" ".dump"`;
      const { stdout } = await execAsync(command);
      fs.writeFileSync(outputPath, stdout);
    } catch (error) {
      console.warn(`Warning: Could not create SQL dump for ${dbPath}`);
    }
  }

  private async compressBackup(sourcePath: string, archivePath: string): Promise<void> {
    try {
      const command = process.platform === 'win32'
        ? `tar -czf "${archivePath}" -C "${path.dirname(sourcePath)}" "${path.basename(sourcePath)}"`
        : `tar -czf "${archivePath}" -C "${path.dirname(sourcePath)}" "${path.basename(sourcePath)}"`;
      
      await execAsync(command);
    } catch (error) {
      throw new Error(`Failed to compress backup: ${error}`);
    }
  }

  private async extractBackup(archivePath: string, extractPath: string): Promise<void> {
    try {
      if (fs.existsSync(extractPath)) {
        fs.rmSync(extractPath, { recursive: true });
      }
      fs.mkdirSync(extractPath, { recursive: true });

      const command = process.platform === 'win32'
        ? `tar -xzf "${archivePath}" -C "${extractPath}" --strip-components=1`
        : `tar -xzf "${archivePath}" -C "${extractPath}" --strip-components=1`;
      
      await execAsync(command);
    } catch (error) {
      throw new Error(`Failed to extract backup: ${error}`);
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// CLI Command handlers
async function handleBackup(options: any) {
  const manager = new DatabaseBackupManager();
  
  try {
    const backupPath = await manager.createBackup({
      includeData: options.includeData,
      compress: options.compress,
      outputDir: options.output
    });
    
    console.log(`\n💾 Backup saved to: ${backupPath}`);
  } catch (error) {
    console.error('❌ Backup failed:', error);
    process.exit(1);
  }
}

async function handleRestore(backupFile: string, options: any) {
  const manager = new DatabaseBackupManager();
  
  try {
    await manager.restoreFromBackup({
      backupFile,
      force: options.force
    });
  } catch (error) {
    console.error('❌ Restore failed:', error);
    process.exit(1);
  }
}

async function handleWipe(options: any) {
  const manager = new DatabaseBackupManager();
  
  try {
    // Create auto-backup unless explicitly disabled
    if (!options.noBackup && !options.force) {
      await manager.createAutoBackup();
    }
    
    await manager.wipeDatabase(options.force);
  } catch (error) {
    console.error('❌ Wipe failed:', error);
    process.exit(1);
  }
}

async function handleList() {
  const manager = new DatabaseBackupManager();
  
  const backups = manager.listBackups();
  
  if (backups.length === 0) {
    console.log('📭 No backups found');
    return;
  }

  console.log('📋 Available backups:\n');
  
  backups.forEach((backup, index) => {
    console.log(`${index + 1}. ${backup.name}`);
    console.log(`   📅 Created: ${backup.created.toLocaleString()}`);
    console.log(`   📊 Size: ${manager['formatBytes'](backup.size)}`);
    console.log(`   🗜️ Compressed: ${backup.compressed ? 'Yes' : 'No'}`);
    console.log(`   📁 Path: ${backup.path}\n`);
  });
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'backup':
      await handleBackup({
        includeData: args.includes('--sql'),
        compress: args.includes('--compress'),
        output: args.includes('--output') ? args[args.indexOf('--output') + 1] : undefined
      });
      break;
      
    case 'restore':
      if (!args[1]) {
        console.error('❌ Please provide backup file path');
        process.exit(1);
      }
      await handleRestore(args[1], {
        force: args.includes('--force')
      });
      break;
      
    case 'wipe':
      await handleWipe({
        force: args.includes('--force'),
        noBackup: args.includes('--no-backup')
      });
      break;
      
    case 'list':
      await handleList();
      break;
      
    default:
      console.log('📚 Database Backup & Management Utility\n');
      console.log('Usage:');
      console.log('  npm run db:backup          - Create backup');
      console.log('  npm run db:backup:compress - Create compressed backup');  
      console.log('  npm run db:restore <file>  - Restore from backup');
      console.log('  npm run db:wipe            - Wipe all databases (with auto-backup)');
      console.log('  npm run db:list            - List available backups');
      console.log('\nOptions:');
      console.log('  --force         - Skip confirmations');
      console.log('  --compress      - Create compressed backup');
      console.log('  --sql           - Include SQL dumps');
      console.log('  --no-backup     - Skip auto-backup when wiping');
      break;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
}

export { DatabaseBackupManager };