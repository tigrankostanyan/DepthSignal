import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserProfile } from '../../types/index.js';

// The secret is mandatory. A weak/known default makes every issued token forgeable,
// so production refuses to boot without a strong JWT_SECRET.
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.trim().length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[FATAL] JWT_SECRET is missing or too short. Set a strong random value (>=32 chars) before starting in production.'
    );
  }
  // Development/test only — this value can never be reached in production.
  console.warn('[SECURITY] JWT_SECRET is not configured. Using an insecure development-only fallback.');
  return 'dev-only-insecure-secret-do-not-use-in-production';
})();
// Keep the user signed in for 7 days (matches the session/cookie lifetime).
const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

//  j w t service
export interface JWTService {
  generateAccessToken(user: UserProfile, fingerprintHash?: string): string;
  verifyAccessToken(token: string): UserProfile;
  verifyAccessTokenWithFingerprint(token: string): { user: UserProfile; fingerprintHash?: string };
  generateRefreshToken(): string; // returns a random string to store in DB
  hashToken(token: string): string; // sha256 digest for DB storage/lookup
}

//  j w t service impl
export class JWTServiceImpl implements JWTService {
  // Generate access token
  generateAccessToken(user: UserProfile, fingerprintHash?: string): string {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        fph: fingerprintHash
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  }

  // Verify access token
  verifyAccessToken(token: string): UserProfile {
    return this.verifyAccessTokenWithFingerprint(token).user;
  }

  // Verify access token and return the bound fingerprint hash
  verifyAccessTokenWithFingerprint(token: string): { user: UserProfile; fingerprintHash?: string } {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      return {
        user: {
          id: decoded.sub,
          email: decoded.email,
          role: decoded.role,
          name: decoded.name,
          createdAt: decoded.createdAt || Date.now()
        },
        fingerprintHash: decoded.fph
      };
    } catch (err) {
      const error: any = new Error('Invalid or expired access token');
      error.statusCode = 401;
      error.code = 'INVALID_ACCESS_TOKEN';
      throw error;
    }
  }

  // Generate refresh token
  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hash a token so the raw value is never persisted
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}