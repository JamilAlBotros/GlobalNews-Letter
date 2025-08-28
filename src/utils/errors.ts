import { randomUUID } from 'crypto';

/**
 * RFC 7807 Problem Details for HTTP APIs
 * Standard error format for consistent error responses
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string | undefined;
  instance: string;
  requestId?: string;
  timestamp?: string;
  errors?: Record<string, any>;
}

/**
 * Base error class for structured error handling
 */
export class ServiceError extends Error {
  public readonly type: string;
  public readonly status: number;
  public readonly detail?: string | undefined;
  public readonly instance: string;

  constructor(
    type: string,
    title: string,
    status: number,
    detail?: string | undefined,
    instance?: string | undefined
  ) {
    super(title);
    this.name = 'ServiceError';
    this.type = type;
    this.status = status;
    this.detail = detail;
    this.instance = instance || randomUUID();
  }

  toProblem(): ProblemDetails {
    return {
      type: this.type,
      title: this.message,
      status: this.status,
      detail: this.detail || undefined,
      instance: this.instance
    };
  }
}

/**
 * Specific error types for different scenarios
 */
export class DatabaseError extends ServiceError {
  constructor(detail?: string, instance?: string) {
    super(
      'about:blank#database-error',
      'Database Operation Failed',
      500,
      detail,
      instance
    );
  }
}

export class ValidationError extends ServiceError {
  constructor(detail?: string, instance?: string) {
    super(
      'about:blank#validation-error',
      'Validation Failed',
      400,
      detail,
      instance
    );
  }
}

export class ExternalServiceError extends ServiceError {
  constructor(service: string, detail?: string, instance?: string) {
    super(
      'about:blank#external-service-error',
      `External Service Error: ${service}`,
      502,
      detail,
      instance
    );
  }
}

export class NotFoundError extends ServiceError {
  constructor(resource: string, detail?: string, instance?: string) {
    super(
      'about:blank#not-found',
      `${resource} Not Found`,
      404,
      detail,
      instance
    );
  }
}

export class DuplicateError extends ServiceError {
  constructor(resource: string, detail?: string, instance?: string) {
    super(
      'about:blank#duplicate-resource',
      `Duplicate ${resource}`,
      409,
      detail,
      instance
    );
  }
}

export class AuthenticationError extends ServiceError {
  constructor(detail?: string, instance?: string) {
    super(
      'about:blank#authentication-error',
      'Authentication Required',
      401,
      detail,
      instance
    );
  }
}

export class AuthorizationError extends ServiceError {
  constructor(detail?: string, instance?: string) {
    super(
      'about:blank#authorization-error',
      'Forbidden',
      403,
      detail,
      instance
    );
  }
}

export class RateLimitError extends ServiceError {
  constructor(detail?: string, instance?: string) {
    super(
      'about:blank#rate-limit-error',
      'Rate Limit Exceeded',
      429,
      detail,
      instance
    );
  }
}

export class TimeoutError extends ServiceError {
  constructor(operation: string, detail?: string, instance?: string) {
    super(
      'about:blank#timeout-error',
      `Operation Timeout: ${operation}`,
      408,
      detail,
      instance
    );
  }
}

/**
 * Error handling utility functions
 */
export class ErrorHandler {
  /**
   * Log structured error with context
   */
  static logError(error: Error, context: Record<string, any> = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      error: error.name,
      stack: error.stack,
      context,
      ...(error instanceof ServiceError && {
        problemDetails: error.toProblem()
      })
    };

    console.error(JSON.stringify(logEntry));
  }

  /**
   * Handle and convert unknown errors to ServiceError
   */
  static handleUnknownError(error: unknown, context: string): ServiceError {
    if (error instanceof ServiceError) {
      return error;
    }

    if (error instanceof Error) {
      this.logError(error, { context });
      return new ServiceError(
        'about:blank#internal-error',
        'Internal Server Error',
        500,
        `${context}: ${error.message}`
      );
    }

    const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred';
    const serviceError = new ServiceError(
      'about:blank#unknown-error',
      'Unknown Error',
      500,
      `${context}: ${errorMessage}`
    );

    this.logError(serviceError, { context, originalError: error });
    return serviceError;
  }

  /**
   * Wrap async function with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw this.handleUnknownError(error, context);
    }
  }
}

/**
 * Request correlation ID utility for tracing
 */
export class RequestContext {
  private static current: string | null = null;

  static setRequestId(requestId: string) {
    this.current = requestId;
  }

  static getRequestId(): string {
    return this.current || randomUUID();
  }

  static clearRequestId() {
    this.current = null;
  }
}