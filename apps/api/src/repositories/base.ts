import { getDatabase, type DatabaseConnection } from '../database/connection.js';
import { ErrorHandler } from '../utils/errors.js';

/**
 * Base repository class providing common database operations
 * Follows repository pattern from archive implementation
 */
export abstract class BaseRepository {
  protected db: DatabaseConnection;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Execute query with error handling and logging
   */
  protected executeQuery<T>(
    operation: string,
    query: string,
    params: any[] = []
  ): T | null {
    try {
      const result = this.db.get<T>(query, ...params);
      return result || null;
    } catch (error) {
      ErrorHandler.logError(error as Error, {
        operation,
        query: query.substring(0, 100),
        params: params.length
      });
      throw error;
    }
  }

  /**
   * Execute query returning all results
   */
  protected executeQueryAll<T>(
    operation: string,
    query: string,
    params: any[] = []
  ): T[] {
    try {
      const results = this.db.all<T>(query, ...params);
      return results || [];
    } catch (error) {
      ErrorHandler.logError(error as Error, {
        operation,
        query: query.substring(0, 100),
        params: params.length
      });
      throw error;
    }
  }

  /**
   * Execute insert/update/delete operation
   */
  protected executeCommand(
    operation: string,
    query: string,
    params: any[] = []
  ): { changes: number; lastInsertRowid: number } {
    try {
      const result = this.db.run(query, ...params);
      return {
        changes: result.changes || 0,
        lastInsertRowid: Number(result.lastInsertRowid || 0)
      };
    } catch (error) {
      ErrorHandler.logError(error as Error, {
        operation,
        query: query.substring(0, 100),
        params: params.length
      });
      throw error;
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  protected executeTransaction<T>(
    operation: string,
    callback: (db: DatabaseConnection) => T
  ): T {
    try {
      // For now, execute callback directly since our connection doesn't support transactions yet
      return callback(this.db);
    } catch (error) {
      ErrorHandler.logError(error as Error, {
        operation: `transaction_${operation}`
      });
      throw error;
    }
  }

  /**
   * Count total records matching criteria
   */
  protected count(
    operation: string,
    query: string,
    params: any[] = []
  ): number {
    const result = this.executeQuery<{ count: number }>(
      operation,
      query,
      params
    );
    return result?.count || 0;
  }

  /**
   * Check if record exists
   */
  protected exists(
    operation: string,
    query: string,
    params: any[] = []
  ): boolean {
    const result = this.executeQuery<{ exists: number }>(
      operation,
      `SELECT EXISTS(${query}) as exists`,
      params
    );
    return result?.exists === 1;
  }
}