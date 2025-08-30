import { z } from "zod";
export declare const Backup: z.ZodObject<{
    filename: z.ZodString;
    size: z.ZodNumber;
    created_at: z.ZodString;
    compressed: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    filename: string;
    size: number;
    compressed: boolean;
}, {
    created_at: string;
    filename: string;
    size: number;
    compressed: boolean;
}>;
export declare const CreateBackupInput: z.ZodObject<{
    compress: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    compress: boolean;
}, {
    compress?: boolean | undefined;
}>;
export declare const BackupResponse: z.ZodObject<{
    filename: z.ZodString;
    size: z.ZodNumber;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    created_at: string;
    filename: string;
    size: number;
}, {
    created_at: string;
    filename: string;
    size: number;
}>;
export declare const RestoreBackupInput: z.ZodObject<{
    filename: z.ZodString;
}, "strip", z.ZodTypeAny, {
    filename: string;
}, {
    filename: string;
}>;
export declare const DatabaseWipeResponse: z.ZodObject<{
    success: z.ZodBoolean;
    tables_cleared: z.ZodArray<z.ZodString, "many">;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    success: boolean;
    tables_cleared: string[];
}, {
    timestamp: string;
    success: boolean;
    tables_cleared: string[];
}>;
export type Backup = z.infer<typeof Backup>;
export type CreateBackupInput = z.infer<typeof CreateBackupInput>;
export type BackupResponse = z.infer<typeof BackupResponse>;
export type RestoreBackupInput = z.infer<typeof RestoreBackupInput>;
export type DatabaseWipeResponse = z.infer<typeof DatabaseWipeResponse>;
