import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth/AuthService.js';
import { extractToken } from '../security/authMiddleware.js';

const IS_PROD = process.env.NODE_ENV === 'production';
const COOKIE_SAME_SITE = IS_PROD ? 'strict' : 'lax';

//  auth controller
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Client ip
  private clientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  }

  // Optional browser-side entropy token (binds the session to the originating client)
  private clientEntropy(req: Request): string | undefined {
    const v = req.headers['x-session-entropy'];
    return Array.isArray(v) ? v[0] : v;
  }

  // Set HTTP-only auth cookies bound with SameSite (Strict in prod, Lax in dev)
  private setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days — stay signed in
      path: '/'
    });
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/'
    });
  }

  // Register endpoint
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, name } = req.body;
      const ip = this.clientIp(req);
      const userAgent = req.headers['user-agent'];
      const entropy = this.clientEntropy(req);
      // New accounts always start with the default USER role.
      const result = await this.authService.register(email, password, name, 'USER', ip, userAgent, entropy);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.status(201).json({ user: result.user, expiresAt: result.expiresAt });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[AUTH FAILURE]', error.message, error.stack);
      res.status(400).json({ error: 'AUTH_FAILED', message: error.message });
    }
  };

  // Login endpoint
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      const ip = this.clientIp(req);
      const userAgent = req.headers['user-agent'];
      const entropy = this.clientEntropy(req);
      const result = await this.authService.login(email, password, ip, userAgent, entropy);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.json({ user: result.user, expiresAt: result.expiresAt });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[AUTH FAILURE]', error.message, error.stack);
      res.status(400).json({ error: 'AUTH_FAILED', message: error.message });
    }
  };

  // Refresh endpoint
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Get refresh token from HttpOnly cookie
      const refreshToken = req.cookies?.refreshToken;
      if (!refreshToken) {
        res.status(401).json({ error: 'REFRESH_TOKEN_MISSING', message: 'Refresh token not provided' });
        return;
      }
      const ip = this.clientIp(req);
      const userAgent = req.headers['user-agent'];
      const entropy = this.clientEntropy(req);
      const result = await this.authService.refreshAccessToken(refreshToken, ip, userAgent, entropy);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.json({ expiresAt: result.expiresAt });
    } catch (err) {
      next(err);
    }
  };

  // Me endpoint
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not authenticated' });
        return;
      }

      // Fetch full user with trial fields
      const db = this.authService['db']; // Access db through authService
      const fullUser = await db.getUserById(req.user.id);
      if (!fullUser) {
        res.status(404).json({ error: 'USER_NOT_FOUND', message: 'User not found' });
        return;
      }

      // Check subscription status as well
      const subscription = await db.getUserSubscription(req.user.id);

      // Calculate trial status
      const now = Date.now();
      let trialStatus = 'active';
      let remainingDays = 0;
      let trialEndDate: number | undefined = undefined;

      if (fullUser.trialEndDate) {
        trialEndDate = fullUser.trialEndDate;
        if (trialEndDate > now) {
          const diffMs = trialEndDate - now;
          remainingDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
          trialStatus = 'active';
        } else {
          // Check if user has an active subscription
          if (subscription.plan !== 'FREE' && subscription.status === 'active') {
            trialStatus = 'expired_with_subscription';
          } else {
            trialStatus = 'expired';
          }
        }
      } else {
        trialStatus = 'no_trial';
      }

      res.json({
        user: {
          ...req.user,
          trialStartDate: fullUser.trialStartDate,
          trialEndDate: fullUser.trialEndDate
        },
        trial: {
          status: trialStatus,
          remainingDays: remainingDays,
          trialEndDate: trialEndDate
        },
        subscription: {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd
        }
      });
    } catch (err) {
      next(err);
    }
  };

  // Logout endpoint
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        const ip = this.clientIp(req);
        await this.authService.logout(refreshToken, req.user?.id, ip);
      }
      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: COOKIE_SAME_SITE,
        path: '/'
      });
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: COOKIE_SAME_SITE,
        path: '/'
      });
      res.json({ status: 'ok', message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  };

  // Config endpoint
  config = (_req: Request, res: Response): void => {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    res.json({ googleClientId: clientId });
  };

  // Google endpoint
  google = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        res.status(400).json({ error: 'MISSING_ID_TOKEN', message: 'idToken is required' });
        return;
      }
      const ip = this.clientIp(req);
      const userAgent = req.headers['user-agent'];
      const entropy = this.clientEntropy(req);
      const result = await this.authService.googleLogin(idToken, ip, userAgent, entropy);
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
      res.json({ user: result.user, expiresAt: result.expiresAt });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('[AUTH FAILURE]', error.message, error.stack);
      res.status(400).json({ error: 'AUTH_FAILED', message: error.message });
    }
  }; 
}
