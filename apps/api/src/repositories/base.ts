import { getDatabase, type DatabaseConnection } from '../database/connection.js';
import { ErrorHandler } from '../utils/errors.js';

/**
 * Base repository class providing common database operations
 * Follows repository pattern from archive implementation
 */
export abstract class BaseRepository {
  protected get db(): DatabaseConnection {
    return getDatabase();
  }

  /**
   * Execute query with error handling and logging
   */
  protected async executeQuery<T>(
    operation: string,
    query: string,
    params: any[] = []
  ): Promise<T | null> {
    try {
      const result = await this.db.get<T>(query, ...params);
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
  protected async executeQueryAll<T>(
    operation: string,
    query: string,
    params: any[] = []
  ): Promise<T[]> {
    try {
      const results = await this.db.all<T>(query, ...params);
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
  protected async executeCommand(
    operation: string,
    query: string,
    params: any[] = []
  ): Promise<{ changes: number; lastInsertRowid?: number }> {
    try {
      const result = await this.db.run(query, ...params);
      return {
        changes: result.changes || 0,
        lastInsertRowid: result.lastInsertRowid
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
  protected async count(
    operation: string,
    query: string,
    params: any[] = []
  ): Promise<number> {
    const result = await this.executeQuery<{ count: number }>(
      operation,
      query,
      params
    );
    return result?.count || 0;
  }

  /**
   * Check if record exists
   */
  protected async exists(
    operation: string,
    query: string,
    params: any[] = []
  ): Promise<boolean> {
    const result = await this.executeQuery<{ exists: boolean }>(
      operation,
      `SELECT EXISTS(${query}) as exists`,
      params
    );
    return result?.exists === true;
  }
}