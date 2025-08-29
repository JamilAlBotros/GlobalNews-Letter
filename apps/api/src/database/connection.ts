import sqlite3 from "sqlite3";
import { promisify } from "util";

export interface DatabaseConnection {
  get<T = any>(sql: string, ...params: any[]): Promise<T | undefined>;
  all<T = any>(sql: string, ...params: any[]): Promise<T[]>;
  run(sql: string, ...params: any[]): Promise<sqlite3.RunResult>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

export class SQLiteConnection implements DatabaseConnection {
  private db: sqlite3.Database;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;
  private dbRun: (sql: string, ...params: any[]) => Promise<sqlite3.RunResult>;
  private dbExec: (sql: string) => Promise<void>;
  private dbClose: () => Promise<void>;

  constructor(dbPath: string = "data/news.db") {
    this.db = new sqlite3.Database(dbPath);
    this.dbGet = promisify(this.db.get.bind(this.db));
    this.dbAll = promisify(this.db.all.bind(this.db));
    this.dbRun = promisify(this.db.run.bind(this.db));
    this.dbExec = promisify(this.db.exec.bind(this.db));
    this.dbClose = promisify(this.db.close.bind(this.db));

    this.configureSQLite();
  }

  private configureSQLite(): void {
    this.db.serialize(() => {
      this.db.run("PRAGMA journal_mode=WAL;");
      this.db.run("PRAGMA foreign_keys=ON;");
      this.db.run("PRAGMA synchronous=NORMAL;");
      this.db.run("PRAGMA cache_size=1000;");
      this.db.run("PRAGMA temp_store=memory;");
    });
  }

  async get<T = any>(sql: string, ...params: any[]): Promise<T | undefined> {
    try {
      return await this.dbGet(sql, ...params);
    } catch (error) {
      console.error(`Database GET error: ${sql}`, error);
      throw error;
    }
  }

  async all<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    try {
      return await this.dbAll(sql, ...params);
    } catch (error) {
      console.error(`Database ALL error: ${sql}`, error);
      throw error;
    }
  }

  async run(sql: string, ...params: any[]): Promise<sqlite3.RunResult> {
    try {
      return await this.dbRun(sql, ...params);
    } catch (error) {
      console.error(`Database RUN error: ${sql}`, error);
      throw error;
    }
  }

  async exec(sql: string): Promise<void> {
    try {
      return await this.dbExec(sql);
    } catch (error) {
      console.error(`Database EXEC error: ${sql}`, error);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      return await this.dbClose();
    } catch (error) {
      console.error("Database close error:", error);
      throw error;
    }
  }

  async transaction<T>(operation: (conn: DatabaseConnection) => Promise<T>): Promise<T> {
    await this.run("BEGIN TRANSACTION");
    try {
      const result = await operation(this);
      await this.run("COMMIT");
      return result;
    } catch (error) {
      await this.run("ROLLBACK");
      throw error;
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

let globalConnection: SQLiteConnection | null = null;

export function getDatabase(): SQLiteConnection {
  if (!globalConnection) {
    globalConnection = new SQLiteConnection();
  }
  return globalConnection;
}

export async function closeDatabase(): Promise<void> {
  if (globalConnection) {
    await globalConnection.close();
    globalConnection = null;
  }
}

process.on("SIGINT", () => closeDatabase());
process.on("SIGTERM", () => closeDatabase());
process.on("exit", () => closeDatabase());