// ==========================================
// USER REPOSITORY (Sequelize / MySQL Data Access Layer)
// ==========================================

import { User, UserAttributes } from '../models/User.js';
import { UserSession } from '../models/UserSession.js';

export class UserRepository {
  public static async findById(id: string): Promise<User | null> {
    try {
      return await User.findByPk(id);
    } catch (e) {
      return null;
    }
  }

  public static async findByEmail(email: string): Promise<User | null> {
    try {
      return await User.findOne({ where: { email: email.toLowerCase() } });
    } catch (e) {
      return null;
    }
  }

  public static async create(userData: Partial<UserAttributes> & { id: string; email: string; passwordHash: string }): Promise<User> {
    return await User.create({
      ...userData,
      email: userData.email.toLowerCase()
    } as any);
  }

  public static async updateSettings(userId: string, settings: Partial<UserAttributes>): Promise<boolean> {
    try {
      const [affected] = await User.update(settings, { where: { id: userId } });
      return affected > 0;
    } catch (e) {
      return false;
    }
  }
}
