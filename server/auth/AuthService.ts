import crypto from 'crypto';
import { DatabaseService } from '../db/database.js';
import { UserProfile, UserRole } from '../../src/types/index.js';

const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export class AuthService {
  private static instance: AuthService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Securely hash password using scrypt with random salt
   */
  public hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return {
      hash: derivedKey.toString('hex'),
      salt
    };
  }

  /**
   * Verify password using timing-safe comparison
   */
  public verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const derivedKey = crypto.scryptSync(password, salt, 64);
      const hashBuffer = Buffer.from(hash, 'hex');
      const keyBuffer = Buffer.from(derivedKey.toString('hex'), 'hex');
      if (hashBuffer.length !== keyBuffer.length) return false;
      return crypto.timingSafeEqual(hashBuffer, keyBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Register a new user
   */
  public register(
    email: string,
    password: string,
    name: string,
    role: UserRole = 'TRADER',
    ipAddress?: string,
    userAgent?: string
  ): { user: UserProfile; token: string; expiresAt: number } {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = this.db.getUserByEmail(normalizedEmail);
    if (existing) {
      const error: any = new Error('A user with this email address already exists');
      error.statusCode = 409;
      error.code = 'USER_ALREADY_EXISTS';
      throw error;
    }

    const { hash, salt } = this.hashPassword(password);
    const user = this.db.createUser({
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      name: name.trim(),
      role
    });

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;
    this.db.createSession(user.id, token, expiresAt, ipAddress, userAgent);

    // Audit log
    this.db.addAuditLog({
      userId: user.id,
      action: 'AUTH_REGISTER',
      resource: 'USER',
      resourceId: user.id,
      details: { email: user.email, name: user.name, role: user.role },
      ipAddress
    });

    return { user, token, expiresAt };
  }

  /**
   * Authenticate user with email and password
   */
  public login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): { user: UserProfile; token: string; expiresAt: number } {
    const normalizedEmail = email.trim().toLowerCase();
    const userWithSecrets = this.db.getUserByEmail(normalizedEmail);

    if (!userWithSecrets) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const isValid = this.verifyPassword(password, userWithSecrets.passwordHash, userWithSecrets.passwordSalt);
    if (!isValid) {
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const user: UserProfile = {
      id: userWithSecrets.id,
      email: userWithSecrets.email,
      name: userWithSecrets.name,
      role: userWithSecrets.role,
      createdAt: userWithSecrets.createdAt
    };

    // Create session token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;
    this.db.createSession(user.id, token, expiresAt, ipAddress, userAgent);

    // Audit log
    this.db.addAuditLog({
      userId: user.id,
      action: 'AUTH_LOGIN',
      resource: 'USER',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress
    });

    return { user, token, expiresAt };
  }

  /**
   * Validate session token
   */
  public validateToken(token: string): UserProfile {
    if (!token) {
      const error: any = new Error('Authentication token required');
      error.statusCode = 401;
      error.code = 'TOKEN_REQUIRED';
      throw error;
    }

    const result = this.db.getSessionByToken(token);
    if (!result) {
      const error: any = new Error('Invalid or revoked session token');
      error.statusCode = 401;
      error.code = 'INVALID_TOKEN';
      throw error;
    }

    if (result.session.expiresAt < Date.now() || result.session.revokedAt) {
      const error: any = new Error('Session has expired or has been revoked');
      error.statusCode = 401;
      error.code = 'SESSION_EXPIRED';
      throw error;
    }

    return result.user;
  }

  /**
   * Logout / revoke session
   */
  public logout(token: string, userId?: string, ipAddress?: string): void {
    if (!token) return;
    this.db.revokeSession(token);

    if (userId) {
      this.db.addAuditLog({
        userId,
        action: 'AUTH_LOGOUT',
        resource: 'SESSION',
        ipAddress
      });
    }
  }
}
