// ==========================================
// SEQUELIZE MODELS - USER & SESSIONS
// ==========================================

import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../db/connection.js';

export interface UserAttributes {
  id: string;
  email: string;
  passwordHash: string;
  role: 'USER' | 'ADMIN';
  tier: 'FREE' | 'PRO' | 'ADVANCED';
  stripeCustomerId?: string | null;
  subscriptionStatus?: string | null;
  telegramChatId?: string | null;
  emailRecipient?: string | null;
  webhookUrl?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'role' | 'tier' | 'createdAt' | 'updatedAt'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public email!: string;
  public passwordHash!: string;
  public role!: 'USER' | 'ADMIN';
  public tier!: 'FREE' | 'PRO' | 'ADVANCED';
  public stripeCustomerId!: string | null;
  public subscriptionStatus!: string | null;
  public telegramChatId!: string | null;
  public emailRecipient!: string | null;
  public webhookUrl!: string | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init(
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('USER', 'ADMIN'),
      defaultValue: 'USER'
    },
    tier: {
      type: DataTypes.ENUM('FREE', 'PRO', 'ADVANCED'),
      defaultValue: 'FREE'
    },
    stripeCustomerId: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    subscriptionStatus: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    telegramChatId: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    emailRecipient: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    webhookUrl: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'users',
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['tier'] },
      { fields: ['role'] }
    ]
  }
);
