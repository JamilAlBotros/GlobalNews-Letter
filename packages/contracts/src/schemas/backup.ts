import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const Backup = z.object({
  filename: z.string().openapi({ description: "Backup filename" }),
  size: z.number().int().min(0).openapi({ description: "Backup file size in bytes" }),
  created_at: z.string().datetime().openapi({ description: "Backup creation timestamp" }),
  compressed: z.boolean().openapi({ description: "Whether the backup is compressed" })
}).openapi("Backup");

export const CreateBackupInput = z.object({
  compress: z.boolean().default(true).openapi({ description: "Whether to compress the backup" })
}).openapi("CreateBackupInput");

export const BackupResponse = z.object({
  filename: z.string().openapi({ description: "Created backup filename" }),
  size: z.number().int().min(0).openapi({ description: "Backup file size in bytes" }),
  created_at: z.string().datetime().openapi({ description: "Backup creation timestamp" })
}).openapi("BackupResponse");

export const RestoreBackupInput = z.object({
  filename: z.string().openapi({ description: "Backup filename to restore" })
}).openapi("RestoreBackupInput");

export const DatabaseWipeResponse = z.object({
  success: z.boolean().openapi({ description: "Whether the database was successfully wiped" }),
  tables_cleared: z.array(z.string()).openapi({ description: "List of tables that were cleared" }),
  timestamp: z.string().datetime().openapi({ description: "Operation timestamp" })
}).openapi("DatabaseWipeResponse");

export type Backup = z.infer<typeof Backup>;
export type CreateBackupInput = z.infer<typeof CreateBackupInput>;
export type BackupResponse = z.infer<typeof BackupResponse>;
export type RestoreBackupInput = z.infer<typeof RestoreBackupInput>;
export type DatabaseWipeResponse = z.infer<typeof DatabaseWipeResponse>;