import * as jose from 'jose';
import { securityConfig, env, isDevelopment } from '../config/environment.js';
import { AuthenticationError, AuthorizationError, ValidationError, ErrorHandler } from '../utils/errors.js';

/**
 * Authentication and Authorization Service
 * JWT-based authentication following CLAUDE.md security guidelines
 */

export interface User {
  id: string;
  username: string;
  email?: string;
  roles: Role[];
  permissions: Permission[];
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface AuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  tokenType: 'Bearer';
}

export interface TokenPayload {
  sub: string; // user ID
  username: string;
  email?: string;
  roles: Role[];
  permissions: Permission[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export type Role = 'admin' | 'editor' | 'viewer' | 'api_user';

export type Permission = 
  | 'feeds:read' 
  | 'feeds:write' 
  | 'feeds:delete'
  | 'articles:read' 
  | 'articles:write'
  | 'articles:select'
  | 'translations:read'
  | 'translations:write'
  | 'analytics:read'
  | 'system:admin'
  | 'health:read';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'feeds:read', 'feeds:write', 'feeds:delete',
    'articles:read', 'articles:write', 'articles:select',
    'translations:read', 'translations:write',
    'analytics:read', 'system:admin', 'health:read'
  ],
  editor: [
    'feeds:read', 'feeds:write',
    'articles:read', 'articles:write', 'articles:select',
    'translations:read', 'translations:write',
    'analytics:read', 'health:read'
  ],
  viewer: [
    'feeds:read', 'articles:read', 'translations:read', 'analytics:read'
  ],
  api_user: [
    'feeds:read', 'feeds:write',
    'articles:read', 'articles:write',
    'translations:read', 'translations:write'
  ]
};

export class AuthService {
  private readonly jwtSecret: Uint8Array;
  private readonly issuer: string;
  private readonly audience: string;
  private readonly expiryTime: string;

  // Mock users for development - in production, these would come from a database
  private readonly mockUsers: Map<string, User> = new Map([
    ['admin', {
      id: 'admin-123',
      username: 'admin',
      email: 'admin@globalnews.com',
      roles: ['admin'],
      permissions: ROLE_PERMISSIONS.admin,
      createdAt: new Date(),
      lastLoginAt: new Date()
    }],
    ['editor', {
      id: 'editor-123',
      username: 'editor',
      email: 'editor@globalnews.com', 
      roles: ['editor'],
      permissions: ROLE_PERMISSIONS.editor,
      createdAt: new Date()
    }],
    ['api', {
      id: 'api-123',
      username: 'api',
      roles: ['api_user'],
      permissions: ROLE_PERMISSIONS.api_user,
      createdAt: new Date()
    }]
  ]);

  constructor() {
    this.jwtSecret = new TextEncoder().encode(securityConfig.jwt.secret);
    this.issuer = securityConfig.jwt.issuer;
    this.audience = securityConfig.jwt.audience;
    this.expiryTime = securityConfig.jwt.expiresIn;
  }

  /**
   * Authenticate user and generate tokens
   */
  async authenticate(username: string, password?: string, apiKey?: string): Promise<AuthToken> {
    try {
      // Skip auth in development if configured
      if (env.DEV_SKIP_AUTH && isDevelopment) {
        return this.generateToken(this.mockUsers.get('admin')!);
      }

      // API key authentication
      if (apiKey) {
        if (apiKey === securityConfig.apiKey) {
          return this.generateToken(this.mockUsers.get('api')!);
        }
        throw new AuthenticationError('Invalid API key');
      }

      // Username/password authentication (mock implementation)
      const user = this.mockUsers.get(username);
      if (!user || !this.validatePassword(password || '', username)) {
        throw new AuthenticationError('Invalid credentials');
      }

      // Update last login
      user.lastLoginAt = new Date();

      return this.generateToken(user);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      ErrorHandler.logError(error as Error, { operation: 'authenticate', username });
      throw new AuthenticationError('Authentication failed');
    }
  }

  /**
   * Verify and decode JWT token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      const { payload } = await jose.jwtVerify(token, this.jwtSecret, {
        issuer: this.issuer,
        audience: this.audience
      });

      return payload as TokenPayload;
    } catch (error: any) {
      if (error.code === 'ERR_JWT_EXPIRED') {
        throw new AuthenticationError('Token expired');
      }
      if (error.code === 'ERR_JWT_INVALID') {
        throw new AuthenticationError('Invalid token');
      }
      
      ErrorHandler.logError(error, { operation: 'verifyToken' });
      throw new AuthenticationError('Token verification failed');
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractTokenFromHeader(authHeader?: string): string {
    if (!authHeader) {
      throw new AuthenticationError('Missing Authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Invalid Authorization header format');
    }

    const token = authHeader.slice(7);
    if (!token) {
      throw new AuthenticationError('Missing token');
    }

    return token;
  }

  /**
   * Check if user has required permission
   */
  hasPermission(user: TokenPayload, requiredPermission: Permission): boolean {
    return user.permissions.includes(requiredPermission);
  }

  /**
   * Check if user has any of the required permissions
   */
  hasAnyPermission(user: TokenPayload, permissions: Permission[]): boolean {
    return permissions.some(permission => user.permissions.includes(permission));
  }

  /**
   * Check if user has required role
   */
  hasRole(user: TokenPayload, requiredRole: Role): boolean {
    return user.roles.includes(requiredRole);
  }

  /**
   * Authorize user for specific action
   */
  authorize(user: TokenPayload, requiredPermission: Permission): void {
    if (!this.hasPermission(user, requiredPermission)) {
      throw new AuthorizationError(`Insufficient permissions. Required: ${requiredPermission}`);
    }
  }

  /**
   * Middleware function for authentication
   */
  async authenticateRequest(authHeader?: string): Promise<TokenPayload> {
    const token = this.extractTokenFromHeader(authHeader);
    return await this.verifyToken(token);
  }

  /**
   * Generate JWT token for user
   */
  private async generateToken(user: User): Promise<AuthToken> {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + this.parseExpiryTime()) * 1000);

    const payload: Omit<TokenPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
      sub: user.id,
      username: user.username,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions
    };

    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(expiresAt)
      .setIssuer(this.issuer)
      .setAudience(this.audience)
      .sign(this.jwtSecret);

    return {
      accessToken: token,
      expiresAt,
      tokenType: 'Bearer'
    };
  }

  /**
   * Parse expiry time string to seconds
   */
  private parseExpiryTime(): number {
    const timeStr = this.expiryTime;
    const unit = timeStr.slice(-1);
    const value = parseInt(timeStr.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 3600; // 1 hour default
    }
  }

  /**
   * Mock password validation - in production, use proper hashing
   */
  private validatePassword(password: string, username: string): boolean {
    // Development mode - simple validation
    if (isDevelopment) {
      return password === 'admin123' || password === username;
    }

    // In production, implement proper password hashing validation
    // Example: return await bcrypt.compare(password, user.hashedPassword);
    return password.length >= 8;
  }

  /**
   * Create user (mock implementation)
   */
  async createUser(userData: {
    username: string;
    email?: string;
    password: string;
    roles: Role[];
  }): Promise<User> {
    if (this.mockUsers.has(userData.username)) {
      throw new ValidationError('Username already exists');
    }

    const permissions = userData.roles.flatMap(role => ROLE_PERMISSIONS[role] || []);
    const uniquePermissions = [...new Set(permissions)];

    const user: User = {
      id: `user-${Date.now()}`,
      username: userData.username,
      email: userData.email,
      roles: userData.roles,
      permissions: uniquePermissions,
      createdAt: new Date()
    };

    this.mockUsers.set(user.username, user);
    return user;
  }

  /**
   * Get user by username
   */
  async getUser(username: string): Promise<User | null> {
    return this.mockUsers.get(username) || null;
  }

  /**
   * Update user permissions
   */
  async updateUserRoles(username: string, roles: Role[]): Promise<User> {
    const user = this.mockUsers.get(username);
    if (!user) {
      throw new ValidationError('User not found');
    }

    const permissions = roles.flatMap(role => ROLE_PERMISSIONS[role] || []);
    const uniquePermissions = [...new Set(permissions)];

    user.roles = roles;
    user.permissions = uniquePermissions;

    this.mockUsers.set(username, user);
    return user;
  }

  /**
   * Health check for auth service
   */
  healthCheck(): { status: 'healthy' | 'unhealthy'; message?: string } {
    try {
      // Verify JWT secret is properly configured
      if (!this.jwtSecret || this.jwtSecret.length < 32) {
        return { status: 'unhealthy', message: 'JWT secret not properly configured' };
      }

      return { status: 'healthy' };
    } catch (error) {
      return { status: 'unhealthy', message: 'Auth service configuration error' };
    }
  }
}

/**
 * Permission checking utilities
 */
export const PermissionUtils = {
  /**
   * Create middleware for specific permission
   */
  requirePermission: (permission: Permission) => {
    return (user: TokenPayload) => {
      if (!user.permissions.includes(permission)) {
        throw new AuthorizationError(`Missing required permission: ${permission}`);
      }
    };
  },

  /**
   * Create middleware for any of multiple permissions
   */
  requireAnyPermission: (permissions: Permission[]) => {
    return (user: TokenPayload) => {
      const hasAny = permissions.some(p => user.permissions.includes(p));
      if (!hasAny) {
        throw new AuthorizationError(`Missing required permissions: ${permissions.join(', ')}`);
      }
    };
  },

  /**
   * Create middleware for specific role
   */
  requireRole: (role: Role) => {
    return (user: TokenPayload) => {
      if (!user.roles.includes(role)) {
        throw new AuthorizationError(`Missing required role: ${role}`);
      }
    };
  }
};

export default AuthService;