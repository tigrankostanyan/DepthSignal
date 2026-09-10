//  lockout service
export class LockoutService {
  // Instance property
  private static instance: LockoutService;
  // Attempts property
  private attempts: Map<string, { count: number; lastAttempt: number }> = new Map();
  //  m a x_ a t t e m p t s property
  private readonly MAX_ATTEMPTS = 5;
  //  l o c k o u t_ d u r a t i o n_ m s property
  private readonly LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  private constructor() {}

  // Get instance
  public static getInstance(): LockoutService {
    if (!LockoutService.instance) {
      LockoutService.instance = new LockoutService();
    }
    return LockoutService.instance;
  }

  // Is locked
  public async isLocked(email: string): Promise<boolean> {
    const record = this.attempts.get(email);
    if (!record) return false;
    if (record.count >= this.MAX_ATTEMPTS) {
      const elapsed = Date.now() - record.lastAttempt;
      if (elapsed < this.LOCKOUT_DURATION_MS) {
        return true;
      } else {
        // Reset if lockout duration has passed
        this.attempts.delete(email);
        return false;
      }
    }
    return false;
  }

  // Record failed attempt
  public async recordFailedAttempt(email: string): Promise<void> {
    const record = this.attempts.get(email);
    if (record) {
      record.count += 1;
      record.lastAttempt = Date.now();
    } else {
      this.attempts.set(email, { count: 1, lastAttempt: Date.now() });
    }
  }

  // Reset attempts
  public async resetAttempts(email: string): Promise<void> {
    this.attempts.delete(email);
  }

  // Get remaining attempts
  public async getRemainingAttempts(email: string): Promise<number> {
    const record = this.attempts.get(email);
    if (!record) return this.MAX_ATTEMPTS;
    return Math.max(0, this.MAX_ATTEMPTS - record.count);
  }
}