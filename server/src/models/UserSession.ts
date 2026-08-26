// ==========================================
// SEQUELIZE MODELS - USER SESSION
// ==========================================

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/connection.js';

export interface UserSessionAttributes {
  id: string;
  userId: string;
  tokenHash: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserSessionCreationAttributes extends Optional<UserSessionAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

export class UserSession extends Model<UserSessionAttributes, UserSessionCreationAttributes> implements UserSessionAttributes {
  public id!: string;
  public userId!: string;
  public tokenHash!: string;
  public ipAddress!: string | null;
  public userAgent!: string | null;
  public expiresAt!: Date;
  public revokedAt!: Date | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserSession.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true
    },
    userId: {
      type: DataTypes.STRING(64),
      allowNull: false
    },
    tokenHash: {
      type: DataTypes.STRING(128),
      allowNull: false
    },
    ipAddress: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'user_sessions',
    indexes: [
      { fields: ['user_id'] },
      { fields: ['token_hash'] },
      { fields: ['expires_at'] }
    ]
  }
);
