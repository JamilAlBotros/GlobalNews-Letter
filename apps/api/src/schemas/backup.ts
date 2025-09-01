import { z } from "zod";

export const Backup = z.object({
  filename: z.string(),
  size: z.number().int().min(0),
  created_at: z.string().datetime(),
  compressed: z.boolean()
});

export const CreateBackupInput = z.object({
  compress: z.boolean().default(true)
});

export const BackupResponse = z.object({
  filename: z.string(),
  size: z.number().int().min(0),
  created_at: z.string().datetime()
});

export const RestoreBackupInput = z.object({
  filename: z.string()
});

export const DatabaseWipeResponse = z.object({
  success: z.boolean(),
  tables_cleared: z.array(z.string()),
  timestamp: z.string().datetime()
});

export type Backup = z.infer<typeof Backup>;
export type CreateBackupInput = z.infer<typeof CreateBackupInput>;
export type BackupResponse = z.infer<typeof BackupResponse>;
export type RestoreBackupInput = z.infer<typeof RestoreBackupInput>;
export type DatabaseWipeResponse = z.infer<typeof DatabaseWipeResponse>;