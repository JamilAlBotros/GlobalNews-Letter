import { DatabaseConnectionManager, type DatabaseConnection } from './connection-manager.js';
import { ErrorHandler, DatabaseError } from '../utils/errors.js';

/**
 * Base repository class with common database operations
 * Provides connection management and transaction support
 */
export abstract class BaseRepository {
  protected connectionManager: DatabaseConnectionManager;
  protected connectionId: string;

  constructor(connectionId: string = 'default') {
    this.connectionManager = DatabaseConnectionManager.getInstance();
    this.connectionId = connectionId;
  }

  /**
   * Get database connection
   */
  protected async getConnection(): Promise<DatabaseConnection> {
    return this.connectionManager.getConnection(this.connectionId);
  }

  /**
   * Execute operation with connection
   */
  protected async withConnection<T>(
    operation: (connection: DatabaseConnection) => Promise<T>
  ): Promise<T> {
    const connection = await this.getConnection();
    return operation(connection);
  }

  /**
   * Execute operation within transaction
   */
  protected async withTransaction<T>(
    operation: (connection: DatabaseConnection) => Promise<T>
  ): Promise<T> {
    return this.connectionManager.transaction(operation, this.connectionId);
  }

  /**
   * Initialize repository (create tables, indexes, etc.)
   */
  abstract initialize(): Promise<void>;

  /**
   * Test repository connectivity
   */
  async testConnection(): Promise<boolean> {
    return ErrorHandler.withErrorHandling(
      async () => {
        const connection = await this.getConnection();
        await connection.get('SELECT 1 as test');
        return true;
      },
      `${this.constructor.name}.testConnection`
    );
  }

  /**
   * Close repository connection
   */
  async close(): Promise<void> {
    await this.connectionManager.closeConnection(this.connectionId);
  }

  /**
   * Utility method for safe SQL parameter binding
   */
  protected preparePlaceholders(count: number): string {
    return Array(count).fill('?').join(', ');
  }

  /**
   * Utility method for building WHERE clauses safely
   */
  protected buildWhereClause(
    conditions: Record<string, any>,
    operator: 'AND' | 'OR' = 'AND'
  ): { clause: string; params: any[] } {
    const entries = Object.entries(conditions).filter(([_, value]) => value !== undefined);
    
    if (entries.length === 0) {
      return { clause: '', params: [] };
    }

    const clauses = entries.map(([key, _]) => `${key} = ?`);
    const params = entries.map(([_, value]) => value);
    
    return {
      clause: `WHERE ${clauses.join(` ${operator} `)}`,
      params
    };
  }

  /**
   * Utility method for building ORDER BY clauses
   */
  protected buildOrderByClause(
    sortBy?: string,
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ): string {
    if (!sortBy) return '';
    
    // Validate sort field (prevent SQL injection)
    const validSortFields = this.getValidSortFields();
    if (validSortFields.length > 0 && !validSortFields.includes(sortBy)) {
      throw new DatabaseError(`Invalid sort field: ${sortBy}`);
    }
    
    return `ORDER BY ${sortBy} ${sortOrder}`;
  }

  /**
   * Override in child classes to define valid sort fields
   */
  protected getValidSortFields(): string[] {
    return [];
  }

  /**
   * Utility method for handling pagination
   */
  protected buildPaginationClause(limit?: number, offset?: number): string {
    const clauses: string[] = [];
    
    if (limit && limit > 0) {
      clauses.push(`LIMIT ${limit}`);
    }
    
    if (offset && offset > 0) {
      clauses.push(`OFFSET ${offset}`);
    }
    
    return clauses.join(' ');
  }

  /**
   * Utility method for counting total records
   */
  protected async countRecords(
    table: string,
    whereClause?: string,
    params: any[] = []
  ): Promise<number> {
    return this.withConnection(async (connection) => {
      const sql = `SELECT COUNT(*) as count FROM ${table} ${whereClause || ''}`;
      const result = await connection.get(sql, ...params);
      return result.count;
    });
  }

  /**
   * Utility method for checking if record exists
   */
  protected async recordExists(
    table: string,
    field: string,
    value: any
  ): Promise<boolean> {
    return this.withConnection(async (connection) => {
      const sql = `SELECT 1 FROM ${table} WHERE ${field} = ? LIMIT 1`;
      const result = await connection.get(sql, value);
      return !!result;
    });
  }
}