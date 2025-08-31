import Database from "better-sqlite3";

export interface DatabaseConnection {
  get<T = any>(sql: string, ...params: any[]): T | undefined;
  all<T = any>(sql: string, ...params: any[]): T[];
  run(sql: string, ...params: any[]): Database.RunResult;
  exec(sql: string): void;
  close(): void;
  healthCheck(): boolean;
}

export class SQLiteConnection implements DatabaseConnection {
  private db: Database.Database;

  constructor(dbPath: string = "data/news.db") {
    this.db = new Database(dbPath);
    this.configureSQLite();
  }

  private configureSQLite(): void {
    this.db.exec("PRAGMA journal_mode=WAL;");
    this.db.exec("PRAGMA foreign_keys=ON;");
    this.db.exec("PRAGMA synchronous=NORMAL;");
    this.db.exec("PRAGMA cache_size=1000;");
    this.db.exec("PRAGMA temp_store=memory;");
  }

  get<T = any>(sql: string, ...params: any[]): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.get(...params) as T | undefined;
    } catch (error) {
      console.error(`Database GET error: ${sql}`, error);
      throw error;
    }
  }

  all<T = any>(sql: string, ...params: any[]): T[] {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params) as T[];
    } catch (error) {
      console.error(`Database ALL error: ${sql}`, error);
      throw error;
    }
  }

  run(sql: string, ...params: any[]): Database.RunResult {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(...params);
    } catch (error) {
      console.error(`Database RUN error: ${sql}`, error);
      throw error;
    }
  }

  exec(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      console.error(`Database EXEC error: ${sql}`, error);
      throw error;
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch (error) {
      console.error("Database close error:", error);
      throw error;
    }
  }

  transaction<T>(operation: (conn: DatabaseConnection) => T): T {
    return this.db.transaction(() => {
      return operation(this);
    })();
  }

  healthCheck(): boolean {
    try {
      this.get("SELECT 1 as test");
      return true;
    } catch {
      return false;
    }
  }
}

let globalConnection: SQLiteConnection | null = null;

export function getDatabase(dbPath?: string): SQLiteConnection {
  if (!globalConnection) {
    const path = dbPath || (process.env.NODE_ENV === 'test' 
      ? `data/test-${process.pid}-${Math.random().toString(36).substr(2, 9)}.db` 
      : 'data/news.db');
    globalConnection = new SQLiteConnection(path);
  }
  return globalConnection;
}

export function closeDatabase(): void {
  if (globalConnection) {
    globalConnection.close();
    globalConnection = null;
  }
}

export function resetDatabase(): void {
  closeDatabase();
}

process.on("SIGINT", () => closeDatabase());
process.on("SIGTERM", () => closeDatabase());
process.on("exit", () => closeDatabase());