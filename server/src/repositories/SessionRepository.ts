import { Op } from 'sequelize';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';

//  session repository
export class SessionRepository {
  // Find by hashed token
  async findByTokenHash(tokenHash: string): Promise<{ session: Session; user: User } | null> {
    const session = await Session.findOne({
      where: { tokenHash },
      include: [{ model: User, as: 'User', required: true }],
    });
    if (!session) return null;
    const user = (session as any).User as User;
    return { session, user };
  }

  // Find by id
  async findById(id: string): Promise<Session | null> {
    return Session.findByPk(id);
  }

  // Create
  async create(data: { id: string; tokenHash?: string; userId?: string; expiresAt?: number; ipAddress?: string; userAgent?: string; fingerprintHash?: string }): Promise<Session> {
    return Session.create({ ...data, createdAt: Date.now() } as any);
  }

  // Revoke
  async revoke(tokenHash: string): Promise<void> {
    await Session.update({ revokedAt: Date.now() }, { where: { tokenHash } });
  }

  // Revoke all by user
  async revokeAllByUser(userId: string): Promise<void> {
    await Session.update({ revokedAt: Date.now() }, { where: { userId, revokedAt: null } });
  }

  // Cleanup expired
  async cleanupExpired(): Promise<void> {
    // Original sql.js semantics: delete expired OR revoked sessions.
    await Session.destroy({
      where: {
        [Op.or]: [
          { expiresAt: { [Op.lt]: Date.now() } },
          { revokedAt: { [Op.ne]: null } },
        ],
      },
    });
  }

  // Count by user
  async countByUser(userId: string): Promise<number> {
    return Session.count({ where: { userId, revokedAt: null } });
  }
}