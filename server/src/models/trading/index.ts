// ==========================================
// SEQUELIZE MODELS - TRADING (AlertRules, WallClusters, Watchlists)
// ==========================================

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../../db/connection.js';

// --- Alert Rule Model ---
export interface AlertRuleAttributes {
  id: string;
  userId: string;
  name: string;
  symbol: string;
  exchange: string;
  marketType: 'SPOT' | 'FUTURES';
  conditionType: string;
  targetPrice?: number | null;
  targetVolume?: number | null;
  minWallUsd?: number | null;
  channels: string; // JSON array string
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED';
  cooldownMinutes: number;
  lastTriggeredAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AlertRule extends Model<AlertRuleAttributes, Optional<AlertRuleAttributes, 'id' | 'createdAt' | 'updatedAt'>> implements AlertRuleAttributes {
  public id!: string;
  public userId!: string;
  public name!: string;
  public symbol!: string;
  public exchange!: string;
  public marketType!: 'SPOT' | 'FUTURES';
  public conditionType!: string;
  public targetPrice!: number | null;
  public targetVolume!: number | null;
  public minWallUsd!: number | null;
  public channels!: string;
  public status!: 'ACTIVE' | 'PAUSED' | 'TRIGGERED';
  public cooldownMinutes!: number;
  public lastTriggeredAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

AlertRule.init(
  {
    id: { type: DataTypes.STRING(64), primaryKey: true },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(128), allowNull: false },
    symbol: { type: DataTypes.STRING(32), allowNull: false },
    exchange: { type: DataTypes.STRING(32), allowNull: false },
    marketType: { type: DataTypes.ENUM('SPOT', 'FUTURES'), defaultValue: 'FUTURES' },
    conditionType: { type: DataTypes.STRING(64), allowNull: false },
    targetPrice: { type: DataTypes.DOUBLE, allowNull: true },
    targetVolume: { type: DataTypes.DOUBLE, allowNull: true },
    minWallUsd: { type: DataTypes.DOUBLE, allowNull: true },
    channels: { type: DataTypes.TEXT, allowNull: false, defaultValue: '["IN_APP"]' },
    status: { type: DataTypes.ENUM('ACTIVE', 'PAUSED', 'TRIGGERED'), defaultValue: 'ACTIVE' },
    cooldownMinutes: { type: DataTypes.INTEGER, defaultValue: 15 },
    lastTriggeredAt: { type: DataTypes.DATE, allowNull: true }
  },
  {
    sequelize,
    tableName: 'alert_rules',
    indexes: [{ fields: ['user_id'] }, { fields: ['symbol'] }, { fields: ['status'] }]
  }
);

// --- Watchlist Model ---
export interface WatchlistAttributes {
  id: string;
  userId: string;
  name: string;
  color?: string | null;
  symbols: string; // JSON array string
  createdAt?: Date;
  updatedAt?: Date;
}

export class Watchlist extends Model<WatchlistAttributes, Optional<WatchlistAttributes, 'id' | 'createdAt' | 'updatedAt'>> implements WatchlistAttributes {
  public id!: string;
  public userId!: string;
  public name!: string;
  public color!: string | null;
  public symbols!: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Watchlist.init(
  {
    id: { type: DataTypes.STRING(64), primaryKey: true },
    userId: { type: DataTypes.STRING(64), allowNull: false },
    name: { type: DataTypes.STRING(128), allowNull: false },
    color: { type: DataTypes.STRING(32), allowNull: true },
    symbols: { type: DataTypes.TEXT, allowNull: false, defaultValue: '[]' }
  },
  {
    sequelize,
    tableName: 'watchlists',
    indexes: [{ fields: ['user_id'] }]
  }
);
