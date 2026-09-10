import { literal, Op } from 'sequelize';
import { User } from '../models/User.js';
import { UserSettings } from '../models/UserSettings.js';
import { AuditLog } from '../models/AuditLog.js';
import { SavedFilterPreset } from '../models/SavedFilterPreset.js';

//  user repository
export class UserRepository {
  // Find by id
  async findById(id: string): Promise<User | null> {
    return User.findByPk(id);
  }

  // Find by email
  async findByEmail(email: string): Promise<User | null> {
    // Original sql.js semantics: normalized (lowercased/trimmed) lookup.
    return User.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  // Create
  async create(data: {
    id: string;
    email?: string;
    passwordHash?: string;
    passwordSalt?: string;
    name?: string;
    role?: string;
    trialStartDate?: number;
    trialEndDate?: number;
  }): Promise<User> {
    return User.create({ ...data, createdAt: Date.now(), updatedAt: Date.now() } as any);
  }

  // Update
  async update(id: string, data: Partial<{ email: string; name: string; role: string; passwordHash: string; passwordSalt: string }>): Promise<void> {
    await User.update({ ...data, updatedAt: Date.now() }, { where: { id } });
  }

  // Update role
  async updateRole(id: string, role: string): Promise<void> {
    await User.update({ role, updatedAt: Date.now() }, { where: { id } });
  }

  // Find all
  async findAll(): Promise<User[]> {
    // Original sql.js semantics: id, email, name, role, created_at — newest first.
    return User.findAll({
      attributes: ['id', 'email', 'name', 'role', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
  }

  // ── UserSettings ──────────────────────────────────────────────────────

  // Find settings
  async findSettings(userId: string): Promise<UserSettings | null> {
    return UserSettings.findOne({ where: { userId } });
  }

  // Upsert settings
  async upsertSettings(userId: string, settings: Record<string, any>): Promise<UserSettings> {
    const existing = await this.findSettings(userId);
    if (existing) {
      await UserSettings.update({ ...settings, updatedAt: Date.now() }, { where: { userId } });
      return (await this.findSettings(userId))!;
    }
    return UserSettings.create({ id: `set_${userId}`, userId, ...settings, updatedAt: Date.now() } as any);
  }

  // ── AuditLog ──────────────────────────────────────────────────────────

  // Create audit log
  async createAuditLog(data: {
    id: string;
    userId?: string;
    action?: string;
    resource?: string;
    resourceId?: string;
    detailsJson?: string;
    ipAddress?: string;
  }): Promise<AuditLog> {
    return AuditLog.create({ ...data, createdAt: Date.now() } as any);
  }

  // Find audit logs
  async findAuditLogs(limit = 100, userId?: string): Promise<AuditLog[]> {
    const where: any = {};
    if (userId) where.userId = userId;
    return AuditLog.findAll({ where, order: [['created_at', 'DESC']], limit });
  }

  // ── SavedFilterPreset ─────────────────────────────────────────────────

  // Find presets
  async findPresets(userId: string): Promise<SavedFilterPreset[]> {
    // Original sql.js semantics: oldest first.
    return SavedFilterPreset.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
  }

  // Create preset
  async createPreset(data: { id: string; userId: string; name?: string; isDefault?: number; filtersJson?: string }): Promise<SavedFilterPreset> {
    return SavedFilterPreset.create({ ...data, createdAt: Date.now() } as any);
  }

  // Delete preset
  async deletePreset(id: string, userId: string): Promise<boolean> {
    const deleted = await SavedFilterPreset.destroy({ where: { id, userId } });
    return deleted > 0;
  }
}