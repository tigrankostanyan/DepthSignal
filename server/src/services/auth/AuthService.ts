import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { DatabaseService } from '../../db/database.js';
import { UserProfile, UserRole } from '../../types/index.js';
import { JWTService, JWTServiceImpl } from './JWTService.js';
import { LockoutService } from './LockoutService.js';
import { computeFingerprintHash } from '../../security/fingerprint.js';

const SESSION_EXPIRY_DAYS = 7;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 5;

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

//  auth service
export class AuthService {
  // Instance property
  private static instance: AuthService;
  // Db property
  private db: DatabaseService;
  // Jwt service property
  private jwtService: JWTService;
  // Lockout service property
  private lockoutService: LockoutService;

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.jwtService = new JWTServiceImpl();
    this.lockoutService = LockoutService.getInstance();
  }

  // Get instance
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Hash password
  public hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return {
      hash: derivedKey.toString('hex'),
      salt
    };
  }

  // Compute a cryptographic client fingerprint from request signals
  private computeFingerprint(ipAddress?: string, userAgent?: string, entropyToken?: string): string {
    return computeFingerprintHash(userAgent, ipAddress, entropyToken);
  }

  // Verify password
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

  // Register
  public async register(
    email: string,
    password: string,
    name: string,
    role: UserRole = 'USER',
    ipAddress?: string,
    userAgent?: string,
    entropyToken?: string
  ): Promise<{ user: UserProfile; accessToken: string; refreshToken: string; expiresAt: number }> {
    try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await this.db.getUserByEmail(normalizedEmail);
    if (existing) {
      const error: any = new Error('A user with this email address already exists');
      error.statusCode = 409;
      error.code = 'USER_ALREADY_EXISTS';
      throw error;
    }

    // A permanently deleted email address can never be registered again.
    if (await this.db.isEmailPermanentlyDeleted(normalizedEmail)) {
      const error: any = new Error('This email address was permanently deleted and can no longer be used to register.');
      error.statusCode = 409;
      error.code = 'EMAIL_PERMANENTLY_DELETED';
      throw error;
    }

    const { hash, salt } = this.hashPassword(password);
    const user = await this.db.createUser({
      email: normalizedEmail,
      passwordHash: hash,
      passwordSalt: salt,
      name: name.trim(),
      role
    });

    // Create refresh token (session) — store only its hash
    const refreshToken = this.jwtService.generateRefreshToken();
    const tokenHash = this.jwtService.hashToken(refreshToken);
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;
    const fingerprintHash = this.computeFingerprint(ipAddress, userAgent, entropyToken);
    await this.db.createSession(user.id, tokenHash, expiresAt, ipAddress, userAgent, fingerprintHash);

    // Generate access token (JWT) bound to the same fingerprint
    const accessToken = this.jwtService.generateAccessToken(user, fingerprintHash);

    // Audit log
    await this.db.addAuditLog({
      userId: user.id,
      action: 'AUTH_REGISTER',
      resource: 'USER',
      resourceId: user.id,
      details: { email: user.email },
      ipAddress
    });

    return { user, accessToken, refreshToken, expiresAt };
    } catch (error: any) {
      console.error('[AUTH FAILURE]', error?.message, error?.stack);
      throw error;
    }
  }

  // Authenticate user with email and password
  // Login
  public async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
    entropyToken?: string
  ): Promise<{ user: UserProfile; accessToken: string; refreshToken: string; expiresAt: number }> {
    try {
    const normalizedEmail = email.trim().toLowerCase();

    // Check if account is locked
    if (await this.lockoutService.isLocked(normalizedEmail)) {
      const remaining = await this.lockoutService.getRemainingAttempts(normalizedEmail);
      const error: any = new Error(`Account temporarily locked. Please wait ${Math.ceil(15 * 60 / 60)} minutes.`);
      error.statusCode = 429;
      error.code = 'ACCOUNT_LOCKED';
      error.remaining = remaining;
      throw error;
    }

    // 1. Strict Find-First Strategy:
    // Fetch user and strictly verify credentials without updating any roles or persistent data.
    const userWithSecrets = await this.db.getUserByEmail(normalizedEmail);

    if (!userWithSecrets) {
      await this.lockoutService.recordFailedAttempt(normalizedEmail);
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const isValid = this.verifyPassword(password, userWithSecrets.passwordHash, userWithSecrets.passwordSalt);
    if (!isValid) {
      await this.lockoutService.recordFailedAttempt(normalizedEmail);
      const error: any = new Error('Invalid email or password');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    await this.lockoutService.resetAttempts(normalizedEmail);

    // 2. Preserve Admin Status:
    // Create the session user object by pulling precisely what is in the DB (preserving ADMIN).
    const user: UserProfile = {
      id: userWithSecrets.id,
      email: userWithSecrets.email,
      name: userWithSecrets.name,
      role: userWithSecrets.role, // strictly preserved from DB
      createdAt: userWithSecrets.createdAt
    };

    // Session limit check
    const activeSessionsCount = await this.db.countActiveSessions(user.id);
    if (activeSessionsCount >= MAX_SESSIONS_PER_USER) {
      await this.db.revokeOldestSession(user.id);
    }

    // Create refresh token (session) — store only its hash
    const refreshToken = this.jwtService.generateRefreshToken();
    const tokenHash = this.jwtService.hashToken(refreshToken);
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;
    const fingerprintHash = this.computeFingerprint(ipAddress, userAgent, entropyToken);
    await this.db.createSession(user.id, tokenHash, expiresAt, ipAddress, userAgent, fingerprintHash);

    // Generate access token (JWT) bound to the same fingerprint
    const accessToken = this.jwtService.generateAccessToken(user, fingerprintHash);

    // Audit log
    await this.db.addAuditLog({
      userId: user.id,
      action: 'AUTH_LOGIN',
      resource: 'USER',
      resourceId: user.id,
      details: { email: user.email, name: user.name, role: user.role },
      ipAddress
    });

    return { user, accessToken, refreshToken, expiresAt };
    } catch (error: any) {
      console.error('[AUTH FAILURE]', error?.message, error?.stack);
      throw error;
    }
  }

  // Validate access token (JWT signature only)
  public async validateToken(token: string): Promise<UserProfile> {
    return (await this.validateAccessToken(token)).user;
  }

  // Validate access token and return the bound fingerprint hash
  public async validateAccessToken(token: string): Promise<{ user: UserProfile; fingerprintHash?: string }> {
    if (!token) {
      const error: any = new Error('Authentication token required');
      error.statusCode = 401;
      error.code = 'TOKEN_REQUIRED';
      throw error;
    }

    return this.jwtService.verifyAccessTokenWithFingerprint(token);
  }

  // Refresh access token
  public async refreshAccessToken(refreshToken: string, ipAddress?: string, userAgent?: string, entropyToken?: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
    if (!refreshToken) {
      const error: any = new Error('Refresh token required');
      error.statusCode = 401;
      error.code = 'REFRESH_TOKEN_REQUIRED';
      throw error;
    }

    const tokenHash = this.jwtService.hashToken(refreshToken);
    const result = await this.db.getSessionByTokenHash(tokenHash);
    if (!result) {
      const error: any = new Error('Invalid refresh token');
      error.statusCode = 401;
      error.code = 'INVALID_REFRESH_TOKEN';
      throw error;
    }

    if (result.session.expiresAt < Date.now() || result.session.revokedAt) {
      const error: any = new Error('Refresh token expired or revoked');
      error.statusCode = 401;
      error.code = 'REFRESH_TOKEN_EXPIRED';
      throw error;
    }

    // Anti-hijacking: the fingerprint is advisory only. A mismatch (e.g. the user's
    // IP changed or they moved between networks) must never sign them out, so we log
    // it and continue instead of revoking the session.
    const storedFingerprint = result.session.fingerprintHash;
    const incomingFingerprint = this.computeFingerprint(ipAddress, userAgent, entropyToken);
    if (storedFingerprint && incomingFingerprint !== storedFingerprint) {
      console.warn('[AUTH] Session fingerprint drift detected — refreshing without revocation');
    }

    // Rotate refresh token: revoke old, create new hashed session
    await this.db.revokeSession(tokenHash);

    const newRefreshToken = this.jwtService.generateRefreshToken();
    const newTokenHash = this.jwtService.hashToken(newRefreshToken);
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;
    await this.db.createSession(result.user.id, newTokenHash, expiresAt, ipAddress, userAgent, incomingFingerprint);

    const accessToken = this.jwtService.generateAccessToken(result.user, incomingFingerprint);

    // Audit log
    await this.db.addAuditLog({
      userId: result.user.id,
      action: 'AUTH_REFRESH',
      resource: 'SESSION',
      details: { ip: ipAddress },
      ipAddress
    });

    return { accessToken, refreshToken: newRefreshToken, expiresAt };
  }

  // Google login
  public async googleLogin(
    idToken: string,
    ipAddress?: string,
    userAgent?: string,
    entropyToken?: string
  ): Promise<{ user: UserProfile; accessToken: string; refreshToken: string; expiresAt: number }> {
    try {
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      payload = ticket.getPayload();
    } catch {
      const error: any = new Error('Invalid Google token');
      error.statusCode = 401;
      error.code = 'GOOGLE_TOKEN_INVALID';
      throw error;
    }
    if (!payload || !payload.email) {
      const error: any = new Error('Invalid Google token — missing email');
      error.statusCode = 401;
      error.code = 'GOOGLE_TOKEN_INVALID';
      throw error;
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    let user = await this.db.getUserByEmail(normalizedEmail);

    // 1. Strict Find-First Strategy:
    // 3. Safe Upsert / Registration Logic:
    // Only create a new user if they do not exist. If they exist, do NOT overwrite core fields.
    if (!user) {
      // A permanently deleted Google account cannot silently re-provision.
      if (await this.db.isEmailPermanentlyDeleted(normalizedEmail)) {
        const error: any = new Error('This email address was permanently deleted and can no longer be used.');
        error.statusCode = 409;
        error.code = 'EMAIL_PERMANENTLY_DELETED';
        throw error;
      }
      // Auto-provision a new user from Google profile
      const randomPassword = crypto.randomBytes(32).toString('hex');
      const { hash, salt } = this.hashPassword(randomPassword);
      const trialStartDate = Date.now();
      const trialEndDate = trialStartDate + 3 * 24 * 60 * 60 * 1000; // 3 days
      const created = await this.db.createUser({
        email: normalizedEmail,
        passwordHash: hash,
        passwordSalt: salt,
        name: payload.name || payload.email.split('@')[0],
        role: 'USER',
        trialStartDate,
        trialEndDate
      });
      user = { ...created, passwordHash: hash, passwordSalt: salt };
    }

    // 2. Preserve Admin Status:
    // By using the fetched `user` object directly, we ensure any manual DB changes (like role='ADMIN') are preserved.
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role, // strictly preserved from DB
      createdAt: user.createdAt
    };

    // Session limit check — do NOT revoke every other session (that would sign the
    // user out of their other devices). Just trim the oldest when over the limit.
    const activeSessionsCount = await this.db.countActiveSessions(userProfile.id);
    if (activeSessionsCount >= MAX_SESSIONS_PER_USER) {
      await this.db.revokeOldestSession(userProfile.id);
    }

    const refreshToken = this.jwtService.generateRefreshToken();
    const tokenHash = this.jwtService.hashToken(refreshToken);
    const expiresAt = Date.now() + SESSION_EXPIRY_MS;
    const fingerprintHash = this.computeFingerprint(ipAddress, userAgent, entropyToken);
    await this.db.createSession(userProfile.id, tokenHash, expiresAt, ipAddress, userAgent, fingerprintHash);

    const accessToken = this.jwtService.generateAccessToken(userProfile, fingerprintHash);

    await this.db.addAuditLog({
      userId: userProfile.id,
      action: 'AUTH_GOOGLE_LOGIN',
      resource: 'USER',
      resourceId: userProfile.id,
      details: { email: userProfile.email, provider: 'google' },
      ipAddress
    });

    return { user: userProfile, accessToken, refreshToken, expiresAt };
    } catch (error: any) {
      console.error('[AUTH FAILURE]', error?.message, error?.stack);
      throw error;
    }
  }

  // Logout
  public async logout(token: string, userId?: string, ipAddress?: string): Promise<void> {
    if (!token) return;
    const tokenHash = this.jwtService.hashToken(token);
    await this.db.revokeSession(tokenHash);

    if (userId) {
      await this.db.addAuditLog({
        userId,
        action: 'AUTH_LOGOUT',
        resource: 'SESSION',
        ipAddress
      });
    }
  }
}