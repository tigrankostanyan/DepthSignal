// ==========================================
// ALERT REPOSITORY (Sequelize / MySQL Data Access Layer)
// ==========================================

import { AlertRule, AlertRuleAttributes } from '../models/trading/index.js';

export class AlertRepository {
  public static async getByUserId(userId: string): Promise<AlertRule[]> {
    try {
      return await AlertRule.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    } catch (e) {
      return [];
    }
  }

  public static async getActiveRules(): Promise<AlertRule[]> {
    try {
      return await AlertRule.findAll({ where: { status: 'ACTIVE' } });
    } catch (e) {
      return [];
    }
  }

  public static async create(ruleData: AlertRuleAttributes): Promise<AlertRule> {
    return await AlertRule.create(ruleData as any);
  }

  public static async updateStatus(ruleId: string, status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED'): Promise<boolean> {
    try {
      const [affected] = await AlertRule.update({ status }, { where: { id: ruleId } });
      return affected > 0;
    } catch (e) {
      return false;
    }
  }

  public static async delete(ruleId: string, userId: string): Promise<boolean> {
    try {
      const deleted = await AlertRule.destroy({ where: { id: ruleId, userId } });
      return deleted > 0;
    } catch (e) {
      return false;
    }
  }
}
