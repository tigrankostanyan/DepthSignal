import { RedisService } from '../redis/RedisService.js';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes

//  account lockout service
export class AccountLockoutService {
  // Redis property
  private redis: RedisService;

  constructor() {
    this.redis = RedisService.getInstance();
  }

  // Get key
  private getKey(email: string): string {
    return `lockout:${email.toLowerCase()}`;
  }

  // Record failed attempt
  async recordFailedAttempt(email: string): Promise<void> {
    const key = this.getKey(email);
    const current = await this.redis.get(key);
    if (current) {
      const count = parseInt(current, 10);
      await this.redis.set(key, (count + 1).toString(), LOCKOUT_DURATION_SECONDS);
    } else {
      await this.redis.set(key, '1', LOCKOUT_DURATION_SECONDS);
    }
  }

  // Is locked
  async isLocked(email: string): Promise<boolean> {
    const key = this.getKey(email);
    const count = await this.redis.get(key);
    if (!count) return false;
    return parseInt(count, 10) >= MAX_FAILED_ATTEMPTS;
  }

  // Reset attempts
  async resetAttempts(email: string): Promise<void> {
    const key = this.getKey(email);
    await this.redis.del(key);
  }

  // Get remaining attempts
  async getRemainingAttempts(email: string): Promise<number> {
    const key = this.getKey(email);
    const count = await this.redis.get(key);
    if (!count) return MAX_FAILED_ATTEMPTS;
    const current = parseInt(count, 10);
    return Math.max(0, MAX_FAILED_ATTEMPTS - current);
  }
}