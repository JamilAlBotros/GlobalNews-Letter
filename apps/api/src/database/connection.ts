import { Pool, PoolClient } from 'pg';

export interface DatabaseConnection {
  get<T = any>(sql: string, ...params: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  run(sql: string, ...params: any[]): Promise<{ changes: number; lastInsertRowid?: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function getConnectionConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'globalnews',
    password: process.env.DB_PASSWORD || 'dev_password_change_in_prod',
    database: process.env.DB_NAME || 'globalnews',
  };
}

export class PostgreSQLConnection implements DatabaseConnection {
  private pool: Pool;

  constructor() {
    const config = getConnectionConfig();
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows[0] as T | undefined;
    } catch (error) {
      console.error(`Database GET error: ${sql}`, error);
      throw error;
    }
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows as T[];
    } catch (error) {
      console.error(`Database ALL error: ${sql}`, error);
      throw error;
    }
  }

  async run(sql: string, ...params: any[]): Promise<{ changes: number; lastInsertRowid?: number }> {
    try {
      const result = await this.pool.query(sql, params);
      return {
        changes: result.rowCount || 0,
        lastInsertRowid: undefined // PostgreSQL doesn't have rowid concept
      };
    } catch (error) {
      console.error(`Database RUN error: ${sql}`, error);
      throw error;
    }
  }

  async exec(sql: string): Promise<void> {
    try {
      await this.pool.query(sql);
    } catch (error) {
      console.error(`Database EXEC error: ${sql}`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      console.error("Database close error:", error);
      throw error;
    }
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.get("SELECT 1 as test");
      return true;
    } catch {
      return false;
    }
  }
}

let globalConnection: PostgreSQLConnection | null = null;

export function getDatabase(): PostgreSQLConnection {
  if (!globalConnection) {
    globalConnection = new PostgreSQLConnection();
  }
  return globalConnection;
}

export async function closeDatabase(): Promise<void> {
  if (globalConnection) {
    await globalConnection.close();
    globalConnection = null;
  }
}

export function resetDatabase(): void {
  closeDatabase();
}

export async function healthCheck(): Promise<boolean> {
  const db = getDatabase();
  return await db.healthCheck();
}

process.on("SIGINT", () => closeDatabase());
process.on("SIGTERM", () => closeDatabase());
process.on("exit", () => closeDatabase());