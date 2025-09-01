import { getDatabase, type DatabaseConnection } from "../database/connection.js";
import { v4 as uuidv4 } from "uuid";

export interface DatabasePollingJob {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  interval_minutes: number;
  feed_filters: string; // JSON string
  last_run_time: string | null;
  next_run_time: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  last_run_stats: string | null; // JSON string
  created_at: string;
  updated_at: string;
}

export interface PollingJobFilters {
  feed_ids?: string[];
  categories?: string[];
  languages?: string[];
  regions?: string[];
  types?: string[];
}

export interface PollingJobStats {
  feeds_processed: number;
  articles_found: number;
  execution_time_ms: number;
}

export interface CreatePollingJobData {
  name: string;
  description?: string;
  interval_minutes: number;
  feed_filters: PollingJobFilters;
}

export interface UpdatePollingJobData {
  name?: string;
  description?: string;
  is_active?: boolean;
  interval_minutes?: number;
  feed_filters?: PollingJobFilters;
}

export class PollingJobRepository {
  private db: DatabaseConnection;

  constructor() {
    this.db = getDatabase();
  }

  findAll(page: number = 1, limit: number = 20): { data: DatabasePollingJob[]; total: number } {
    const offset = (page - 1) * limit;
    
    const totalResult = this.db.get<{ count: number }>('SELECT COUNT(*) as count FROM polling_jobs');
    const total = totalResult?.count || 0;
    
    const data = this.db.all<DatabasePollingJob>(`
      SELECT * FROM polling_jobs 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `, limit, offset);
    
    return { data, total };
  }

  findActive(): DatabasePollingJob[] {
    return this.db.all<DatabasePollingJob>('SELECT * FROM polling_jobs WHERE is_active = TRUE ORDER BY next_run_time ASC');
  }

  findById(id: string): DatabasePollingJob | null {
    const result = this.db.get<DatabasePollingJob>('SELECT * FROM polling_jobs WHERE id = ?', id);
    return result || null;
  }

  create(data: CreatePollingJobData): DatabasePollingJob {
    const id = uuidv4();
    const now = new Date().toISOString();
    const nextRunTime = new Date(Date.now() + data.interval_minutes * 60 * 1000).toISOString();

    const result = this.db.run(`
      INSERT INTO polling_jobs (
        id, name, description, is_active, interval_minutes, feed_filters,
        next_run_time, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id,
      data.name,
      data.description || null,
      true,
      data.interval_minutes,
      JSON.stringify(data.feed_filters),
      nextRunTime,
      now,
      now
    );

    if (result.changes === 0) {
      throw new Error('Failed to create polling job');
    }

    return this.findById(id)!;
  }

  update(id: string, data: UpdatePollingJobData): DatabasePollingJob | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description || null);
    }

    if (data.is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(data.is_active);
      
      // If activating, set next run time
      if (data.is_active) {
        const intervalMinutes = data.interval_minutes || existing.interval_minutes;
        const nextRunTime = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
        updates.push('next_run_time = ?');
        values.push(nextRunTime);
      } else {
        // If deactivating, clear next run time
        updates.push('next_run_time = ?');
        values.push(null);
      }
    }

    if (data.interval_minutes !== undefined) {
      updates.push('interval_minutes = ?');
      values.push(data.interval_minutes);
      
      // Update next run time if job is active
      if (existing.is_active || data.is_active) {
        const nextRunTime = new Date(Date.now() + data.interval_minutes * 60 * 1000).toISOString();
        updates.push('next_run_time = ?');
        values.push(nextRunTime);
      }
    }

    if (data.feed_filters !== undefined) {
      updates.push('feed_filters = ?');
      values.push(JSON.stringify(data.feed_filters));
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    const result = this.db.run(`
      UPDATE polling_jobs 
      SET ${updates.join(', ')} 
      WHERE id = ?
    `, ...values);

    if (result.changes === 0) {
      throw new Error('Failed to update polling job');
    }

    return this.findById(id)!;
  }

  delete(id: string): boolean {
    const result = this.db.run('DELETE FROM polling_jobs WHERE id = ?', id);
    return result.changes > 0;
  }

  updateRunStats(id: string, stats: PollingJobStats, success: boolean): void {
    const job = this.findById(id);
    if (!job) return;

    const now = new Date().toISOString();
    const nextRunTime = new Date(Date.now() + job.interval_minutes * 60 * 1000).toISOString();

    this.db.run(`
      UPDATE polling_jobs 
      SET 
        last_run_time = ?,
        next_run_time = ?,
        total_runs = total_runs + 1,
        successful_runs = successful_runs + ?,
        failed_runs = failed_runs + ?,
        last_run_stats = ?,
        updated_at = ?
      WHERE id = ?
    `,
      now,
      job.is_active ? nextRunTime : null,
      success ? 1 : 0,
      success ? 0 : 1,
      JSON.stringify(stats),
      now,
      id
    );
  }

  findJobsDueForExecution(): DatabasePollingJob[] {
    const now = new Date().toISOString();
    return this.db.all<DatabasePollingJob>(`
      SELECT * FROM polling_jobs 
      WHERE is_active = TRUE 
      AND next_run_time IS NOT NULL 
      AND next_run_time <= ? 
      ORDER BY next_run_time ASC
    `, now);
  }
}

export const pollingJobRepository = new PollingJobRepository();