import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  user telegram link
export class UserTelegramLink extends Model<InferAttributes<UserTelegramLink>, InferCreationAttributes<UserTelegramLink>> {
  // User id property
  declare userId: CreationOptional<string>;
  // Telegram chat id property
  declare telegramChatId: CreationOptional<string>;
  // Telegram user id property
  declare telegramUserId: CreationOptional<string>;
  // Telegram username property
  declare telegramUsername: CreationOptional<string | null>;
  // Linked at property
  declare linkedAt: CreationOptional<number>;
  // Enabled property
  declare enabled: CreationOptional<number>;
  // Updated at property
  declare updatedAt: CreationOptional<number>;
}

UserTelegramLink.init(
  {
    userId: { type: DataTypes.STRING, primaryKey: true },
    telegramChatId: { type: DataTypes.STRING, allowNull: false },
    telegramUserId: { type: DataTypes.STRING, allowNull: false, unique: true },
    telegramUsername: { type: DataTypes.STRING, allowNull: true },
    linkedAt: { type: DataTypes.BIGINT, allowNull: false },
    enabled: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    updatedAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: 'UserTelegramLink',
    tableName: 'user_telegram_links',
    indexes: [
      { fields: ['telegram_chat_id'] },
      { fields: ['telegram_user_id'] },
    ],
  }
);