import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  telegram link token
export class TelegramLinkToken extends Model<InferAttributes<TelegramLinkToken>, InferCreationAttributes<TelegramLinkToken>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string>;
  // Token hash property
  declare tokenHash: CreationOptional<string>;
  // Expires at property
  declare expiresAt: CreationOptional<number>;
  // Used at property
  declare usedAt: CreationOptional<number | null>;
  // Created at property
  declare createdAt: CreationOptional<number>;
}

TelegramLinkToken.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    tokenHash: { type: DataTypes.STRING, allowNull: false, unique: true },
    expiresAt: { type: DataTypes.BIGINT, allowNull: false },
    usedAt: { type: DataTypes.BIGINT, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
  },
  {
    sequelize,
    modelName: 'TelegramLinkToken',
    tableName: 'telegram_link_tokens',
    indexes: [
      { fields: ['token_hash'] },
      { fields: ['user_id'] },
    ],
  }
);