/**
 * Enhanced error handling utilities adapted from archive
 * Provides comprehensive error types and centralized error handling
 */

export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.context = context;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApplicationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 400, true, context);
  }
}

export class NotFoundError extends ApplicationError {
  constructor(resource: string, identifier?: string) {
    const message = identifier 
      ? `${resource} with identifier '${identifier}' not found`
      : `${resource} not found`;
    super(message, 404, true, { resource, identifier });
  }
}

export class ConflictError extends ApplicationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 409, true, context);
  }
}

export class ExternalServiceError extends ApplicationError {
  public readonly service: string;
  public readonly originalError?: Error;

  constructor(
    service: string,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(`${service} service error: ${message}`, 502, true, context);
    this.service = service;
    this.originalError = originalError;
  }
}

export class TimeoutError extends ApplicationError {
  public readonly operation: string;
  public readonly timeoutMs: number;

  constructor(operation: string, timeoutMs: number) {
    super(`Operation '${operation}' timed out after ${timeoutMs}ms`, 408, true, {
      operation,
      timeoutMs
    });
    this.operation = operation;
    this.timeoutMs = timeoutMs;
  }
}

export class DatabaseError extends ApplicationError {
  public readonly operation: string;
  public readonly originalError?: Error;

  constructor(
    operation: string,
    message: string,
    originalError?: Error,
    context?: Record<string, unknown>
  ) {
    super(`Database error during ${operation}: ${message}`, 500, true, context);
    this.operation = operation;
    this.originalError = originalError;
  }
}

export class RateLimitError extends ApplicationError {
  public readonly retryAfter?: number;

  constructor(message = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 429, true, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

/**
 * Enhanced error handler with logging and context preservation
 */
export class ErrorHandler {
  /**
   * Central error handling with structured logging
   */
  static handleError(error: Error, context?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    
    if (error instanceof ApplicationError) {
      console.error(`[${timestamp}] ${error.name}:`, {
        message: error.message,
        statusCode: error.statusCode,
        context: { ...error.context, ...context },
        stack: error.stack,
      });
    } else {
      console.error(`[${timestamp}] UnhandledError:`, {
        message: error.message,
        context,
        stack: error.stack,
      });
    }
  }

  /**
   * Handle external service errors with retry information
   */
  static handleExternalServiceError(
    serviceName: string,
    error: unknown,
    context?: Record<string, unknown>
  ): never {
    if (error instanceof Error) {
      const serviceError = new ExternalServiceError(
        serviceName,
        error.message,
        error,
        context
      );
      this.handleError(serviceError);
      throw serviceError;
    }

    const unknownError = new ExternalServiceError(
      serviceName,
      'Unknown error occurred',
      undefined,
      { originalError: error, ...context }
    );
    this.handleError(unknownError);
    throw unknownError;
  }

  /**
   * Wrap async operations with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: Record<string, unknown>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.handleError(error as Error, { operation: operationName, ...context });
      throw error;
    }
  }

  /**
   * Log error without throwing - useful for non-critical operations
   */
  static logError(error: Error, context?: Record<string, unknown>): void {
    this.handleError(error, context);
  }

  /**
   * Create standardized error response for API
   */
  static toErrorResponse(error: Error): {
    type: string;
    title: string;
    status: number;
    detail: string;
    instance?: string;
    context?: Record<string, unknown>;
  } {
    if (error instanceof ApplicationError) {
      return {
        type: 'about:blank',
        title: error.name,
        status: error.statusCode,
        detail: error.message,
        context: error.context,
      };
    }

    return {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
    };
  }
}

/**
 * Retry utility with exponential backoff and jitter
 */
export class RetryHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelayMs?: number;
      maxDelayMs?: number;
      jitter?: boolean;
      retryCondition?: (error: Error) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelayMs = 1000,
      maxDelayMs = 10000,
      jitter = true,
      retryCondition = (error) => !(error instanceof ValidationError)
    } = options;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on last attempt or if condition fails
        if (attempt === maxRetries || !retryCondition(lastError)) {
          throw lastError;
        }

        // Calculate delay with exponential backoff and optional jitter
        let delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
        if (jitter) {
          delay *= 0.5 + Math.random() * 0.5; // Add 0-50% jitter
        }

        console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms:`, {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}