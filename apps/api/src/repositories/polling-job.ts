import { DatabaseConnection, getDatabase } from "../database/connection.js";
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

  async findAll(page: number = 1, limit: number = 20): Promise<{ data: DatabasePollingJob[]; total: number }> {
    const offset = (page - 1) * limit;
    
    const totalResult = await this.db.get('SELECT COUNT(*) as count FROM polling_jobs');
    const total = (totalResult as { count: number }).count;
    
    const data = await this.db.all(`
      SELECT * FROM polling_jobs 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `, limit, offset) as DatabasePollingJob[];
    
    return { data, total };
  }

  async findActive(): Promise<DatabasePollingJob[]> {
    return await this.db.all('SELECT * FROM polling_jobs WHERE is_active = true ORDER BY next_run_time ASC') as DatabasePollingJob[];
  }

  async findById(id: string): Promise<DatabasePollingJob | null> {
    return await this.db.get('SELECT * FROM polling_jobs WHERE id = $1', id) as DatabasePollingJob | null;
  }

  async create(data: CreatePollingJobData): Promise<DatabasePollingJob> {
    const id = uuidv4();
    const now = new Date().toISOString();
    const nextRunTime = new Date(Date.now() + data.interval_minutes * 60 * 1000).toISOString();

    const result = await this.db.run(`
      INSERT INTO polling_jobs (
        id, name, description, is_active, interval_minutes, feed_filters,
        next_run_time, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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

    const created = await this.findById(id);
    if (!created) {
      throw new Error('Failed to retrieve created polling job');
    }
    return created;
  }

  async update(id: string, data: UpdatePollingJobData): Promise<DatabasePollingJob | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }

    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description || null);
    }

    if (data.is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
      
      // If activating, set next run time
      if (data.is_active) {
        const intervalMinutes = data.interval_minutes || existing.interval_minutes;
        const nextRunTime = new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
        updates.push(`next_run_time = $${paramIndex++}`);
        values.push(nextRunTime);
      } else {
        // If deactivating, clear next run time
        updates.push(`next_run_time = $${paramIndex++}`);
        values.push(null);
      }
    }

    if (data.interval_minutes !== undefined) {
      updates.push(`interval_minutes = $${paramIndex++}`);
      values.push(data.interval_minutes);
      
      // Update next run time if job is active
      if (existing.is_active || data.is_active) {
        const nextRunTime = new Date(Date.now() + data.interval_minutes * 60 * 1000).toISOString();
        updates.push(`next_run_time = $${paramIndex++}`);
        values.push(nextRunTime);
      }
    }

    if (data.feed_filters !== undefined) {
      updates.push(`feed_filters = $${paramIndex++}`);
      values.push(JSON.stringify(data.feed_filters));
    }

    if (updates.length === 0) return existing;

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(now);
    values.push(id);

    const result = await this.db.run(`
      UPDATE polling_jobs 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
    `, ...values);

    if (result.changes === 0) {
      throw new Error('Failed to update polling job');
    }

    return await this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.run('DELETE FROM polling_jobs WHERE id = $1', id);
    return result.changes > 0;
  }

  async updateRunStats(id: string, stats: PollingJobStats, success: boolean): Promise<void> {
    const job = await this.findById(id);
    if (!job) return;

    const now = new Date().toISOString();
    const nextRunTime = new Date(Date.now() + job.interval_minutes * 60 * 1000).toISOString();

    await this.db.run(`
      UPDATE polling_jobs 
      SET 
        last_run_time = $1,
        next_run_time = $2,
        total_runs = total_runs + 1,
        successful_runs = successful_runs + $3,
        failed_runs = failed_runs + $4,
        last_run_stats = $5,
        updated_at = $6
      WHERE id = $7
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

  async findJobsDueForExecution(): Promise<DatabasePollingJob[]> {
    const now = new Date().toISOString();
    return await this.db.all(`
      SELECT * FROM polling_jobs 
      WHERE is_active = TRUE 
      AND next_run_time IS NOT NULL 
      AND next_run_time <= $1 
      ORDER BY next_run_time ASC
    `, now) as DatabasePollingJob[];
  }
}

export const pollingJobRepository = new PollingJobRepository();