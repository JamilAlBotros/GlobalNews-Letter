import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import { DatabaseError, ErrorHandler } from '../utils/errors.js';
import { appConfig } from '../config/index.js';

/**
 * Database connection interface for better abstraction
 */
export interface DatabaseConnection {
  get(sql: string, ...params: any[]): Promise<any>;
  all(sql: string, ...params: any[]): Promise<any[]>;
  run(sql: string, ...params: any[]): Promise<sqlite3.RunResult>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

/**
 * SQLite connection wrapper with proper error handling
 */
export class SQLiteConnection implements DatabaseConnection {
  private db: sqlite3.Database;
  private dbGet: (sql: string, ...params: any[]) => Promise<any>;
  private dbAll: (sql: string, ...params: any[]) => Promise<any[]>;
  private dbRun: (sql: string, ...params: any[]) => Promise<sqlite3.RunResult>;
  private dbExec: (sql: string) => Promise<void>;
  private dbClose: () => Promise<void>;

  constructor(db: sqlite3.Database) {
    this.db = db;
    this.dbGet = promisify(db.get.bind(db));
    this.dbAll = promisify(db.all.bind(db));
    this.dbRun = promisify(db.run.bind(db));
    this.dbExec = promisify(db.exec.bind(db));
    this.dbClose = promisify(db.close.bind(db));
  }

  async get(sql: string, ...params: any[]): Promise<any> {
    return ErrorHandler.withErrorHandling(
      async () => this.dbGet(sql, ...params),
      `SQLiteConnection.get(${sql})`
    );
  }

  async all(sql: string, ...params: any[]): Promise<any[]> {
    return ErrorHandler.withErrorHandling(
      async () => this.dbAll(sql, ...params),
      `SQLiteConnection.all(${sql})`
    );
  }

  async run(sql: string, ...params: any[]): Promise<sqlite3.RunResult> {
    return ErrorHandler.withErrorHandling(
      async () => this.dbRun(sql, ...params),
      `SQLiteConnection.run(${sql})`
    );
  }

  async exec(sql: string): Promise<void> {
    return ErrorHandler.withErrorHandling(
      async () => this.dbExec(sql),
      `SQLiteConnection.exec(${sql})`
    );
  }

  async close(): Promise<void> {
    return ErrorHandler.withErrorHandling(
      async () => this.dbClose(),
      'SQLiteConnection.close'
    );
  }
}

/**
 * Database connection manager with connection pooling and lifecycle management
 */
export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private connections: Map<string, SQLiteConnection> = new Map();
  private connectionCount = 0;
  private maxConnections = 5;
  private connectionTimeout = 30000; // 30 seconds
  private isShuttingDown = false;

  private constructor() {
    // Setup graceful shutdown handlers
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('exit', () => this.closeAllConnections());
  }

  static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Get a database connection (reuse existing or create new)
   */
  async getConnection(connectionId: string = 'default'): Promise<SQLiteConnection> {
    if (this.isShuttingDown) {
      throw new DatabaseError('Database is shutting down, no new connections allowed');
    }

    // Return existing connection if available
    if (this.connections.has(connectionId)) {
      return this.connections.get(connectionId)!;
    }

    // Check connection limit
    if (this.connectionCount >= this.maxConnections) {
      throw new DatabaseError(`Maximum connections (${this.maxConnections}) reached`);
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        const db = await this.createDatabase();
        const connection = new SQLiteConnection(db);
        
        this.connections.set(connectionId, connection);
        this.connectionCount++;

        console.log(`Created database connection: ${connectionId} (${this.connectionCount}/${this.maxConnections})`);
        
        return connection;
      },
      `DatabaseConnectionManager.getConnection(${connectionId})`
    );
  }

  /**
   * Create and configure a new SQLite database instance
   */
  private createDatabase(): Promise<sqlite3.Database> {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database(appConfig.DATABASE_PATH, (err) => {
        if (err) {
          reject(new DatabaseError(`Failed to open database: ${err.message}`));
          return;
        }

        // Configure SQLite for better performance and stability
        db.serialize(() => {
          db.run('PRAGMA journal_mode=WAL;');
          db.run('PRAGMA foreign_keys=ON;');
          db.run('PRAGMA synchronous=NORMAL;');
          db.run('PRAGMA cache_size=1000;');
          db.run('PRAGMA temp_store=memory;');
        });

        resolve(db);
      });

      // Set timeout for connection
      setTimeout(() => {
        reject(new DatabaseError('Database connection timeout'));
      }, this.connectionTimeout);
    });
  }

  /**
   * Close a specific connection
   */
  async closeConnection(connectionId: string = 'default'): Promise<boolean> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    return ErrorHandler.withErrorHandling(
      async () => {
        await connection.close();
        this.connections.delete(connectionId);
        this.connectionCount--;
        
        console.log(`Closed database connection: ${connectionId} (${this.connectionCount}/${this.maxConnections})`);
        return true;
      },
      `DatabaseConnectionManager.closeConnection(${connectionId})`
    );
  }

  /**
   * Close all connections
   */
  async closeAllConnections(): Promise<void> {
    const connectionIds = Array.from(this.connections.keys());
    
    await Promise.all(
      connectionIds.map(id => this.closeConnection(id))
    );
    
    console.log('All database connections closed');
  }

  /**
   * Execute transaction with automatic rollback on error
   */
  async transaction<T>(
    operation: (connection: DatabaseConnection) => Promise<T>,
    connectionId: string = 'default'
  ): Promise<T> {
    const connection = await this.getConnection(connectionId);
    
    return ErrorHandler.withErrorHandling(
      async () => {
        await connection.run('BEGIN TRANSACTION');
        
        try {
          const result = await operation(connection);
          await connection.run('COMMIT');
          return result;
        } catch (error) {
          await connection.run('ROLLBACK');
          throw error;
        }
      },
      `DatabaseConnectionManager.transaction(${connectionId})`
    );
  }

  /**
   * Test database connectivity
   */
  async testConnection(connectionId: string = 'test'): Promise<boolean> {
    try {
      const connection = await this.getConnection(connectionId);
      await connection.get('SELECT 1 as test');
      await this.closeConnection(connectionId);
      return true;
    } catch (error) {
      console.error('Database connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    activeConnections: number;
    maxConnections: number;
    connectionIds: string[];
    isShuttingDown: boolean;
  } {
    return {
      activeConnections: this.connectionCount,
      maxConnections: this.maxConnections,
      connectionIds: Array.from(this.connections.keys()),
      isShuttingDown: this.isShuttingDown
    };
  }

  /**
   * Graceful shutdown handler
   */
  private async gracefulShutdown(signal: string): Promise<void> {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    this.isShuttingDown = true;
    
    try {
      await this.closeAllConnections();
      console.log('Database connections closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }
}

/**
 * Convenience function to get default database connection
 */
export async function getDatabase(): Promise<SQLiteConnection> {
  return DatabaseConnectionManager.getInstance().getConnection();
}

/**
 * Convenience function to execute database transaction
 */
export async function withTransaction<T>(
  operation: (connection: DatabaseConnection) => Promise<T>
): Promise<T> {
  return DatabaseConnectionManager.getInstance().transaction(operation);
}