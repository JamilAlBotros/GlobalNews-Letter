import { FastifyInstance } from "fastify";
import { readdir, stat, readFile, writeFile, unlink } from "fs/promises";
import { join, extname } from "path";
import { createGzip, createGunzip } from "zlib";
import { pipeline } from "stream/promises";
import { createReadStream, createWriteStream } from "fs";
import { Backup, CreateBackupInput, BackupResponse, RestoreBackupInput, DatabaseWipeResponse } from "../schemas/backup.js";
import { getDatabase } from "../database/connection.js";

const BACKUP_DIR = join(process.cwd(), "data", "backups");

async function ensureBackupDir(): Promise<void> {
  try {
    await stat(BACKUP_DIR);
  } catch {
    const { mkdir } = await import("fs/promises");
    await mkdir(BACKUP_DIR, { recursive: true });
  }
}

export async function backupRoutes(app: FastifyInstance): Promise<void> {
  const db = getDatabase();

  // List all backups
  app.get("/admin/backups", async (request, reply) => {
    await ensureBackupDir();
    
    try {
      const files = await readdir(BACKUP_DIR);
      const backups: Backup[] = [];
      
      for (const filename of files) {
        if (filename.endsWith('.db') || filename.endsWith('.db.gz')) {
          const filepath = join(BACKUP_DIR, filename);
          const stats = await stat(filepath);
          
          backups.push({
            filename,
            size: stats.size,
            created_at: stats.birthtime.toISOString(),
            compressed: filename.endsWith('.gz')
          });
        }
      }
      
      // Sort by creation date, newest first
      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return reply.send(backups);
    } catch (error) {
      throw Object.assign(new Error("Failed to list backups"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Create backup
  app.post("/admin/backups", async (request, reply) => {
    const body = CreateBackupInput.parse(request.body);
    await ensureBackupDir();
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const baseFilename = `backup-${timestamp}.db`;
      const filename = body.compress ? `${baseFilename}.gz` : baseFilename;
      const filepath = join(BACKUP_DIR, filename);
      
      // Create backup using SQLite's backup API
      const backupSql = `
        VACUUM INTO '${filepath.replace(/'/g, "''").replace('.gz', '')}'
      `;
      
      db.exec(backupSql);
      
      let finalSize = 0;
      
      if (body.compress) {
        const uncompressedPath = filepath.replace('.gz', '');
        const compressedPath = filepath;
        
        // Compress the backup file
        await pipeline(
          createReadStream(uncompressedPath),
          createGzip(),
          createWriteStream(compressedPath)
        );
        
        // Remove uncompressed file and get compressed size
        await unlink(uncompressedPath);
        const stats = await stat(compressedPath);
        finalSize = stats.size;
      } else {
        const stats = await stat(filepath);
        finalSize = stats.size;
      }
      
      const response: BackupResponse = {
        filename,
        size: finalSize,
        created_at: new Date().toISOString()
      };
      
      return reply.code(201).send(response);
    } catch (error) {
      throw Object.assign(new Error("Failed to create backup"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Restore backup
  app.post("/admin/backups/restore", async (request, reply) => {
    const body = RestoreBackupInput.parse(request.body);
    await ensureBackupDir();
    
    try {
      const backupPath = join(BACKUP_DIR, body.filename);
      const dbPath = join(process.cwd(), "data", "news.db");
      
      // Check if backup file exists
      await stat(backupPath);
      
      // Close current database connection
      db.close();
      
      if (body.filename.endsWith('.gz')) {
        // Decompress backup file
        await pipeline(
          createReadStream(backupPath),
          createGunzip(),
          createWriteStream(dbPath)
        );
      } else {
        // Copy backup file
        const backupData = await readFile(backupPath);
        await writeFile(dbPath, backupData);
      }
      
      return reply.send({
        success: true,
        message: `Database restored from backup: ${body.filename}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      throw Object.assign(new Error("Failed to restore backup"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });

  // Wipe database
  app.delete("/admin/database", async (request, reply) => {
    try {
      const tables = ['translation_jobs', 'articles', 'feeds'];
      
      // Clear all tables (order matters for foreign keys)
      for (const table of tables) {
        db.exec(`DELETE FROM ${table}`);
      }
      
      // Vacuum to reclaim space
      db.exec('VACUUM');
      
      const response: DatabaseWipeResponse = {
        success: true,
        tables_cleared: tables,
        timestamp: new Date().toISOString()
      };
      
      return reply.send(response);
    } catch (error) {
      throw Object.assign(new Error("Failed to wipe database"), {
        status: 500,
        detail: (error as Error).message
      });
    }
  });
}