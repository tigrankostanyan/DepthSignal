import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  notification delivery
export class NotificationDelivery extends Model<InferAttributes<NotificationDelivery>, InferCreationAttributes<NotificationDelivery>> {
  // Id property
  declare id: CreationOptional<string>;
  // Alert trigger id property
  declare alertTriggerId: CreationOptional<string | null>;
  // User id property
  declare userId: CreationOptional<string>;
  // Channel property
  declare channel: CreationOptional<string>;
  // Destination property
  declare destination: CreationOptional<string | null>;
  // Status property
  declare status: CreationOptional<string>;
  // Attempts property
  declare attempts: CreationOptional<number>;
  // Max attempts property
  declare maxAttempts: CreationOptional<number>;
  // Next attempt at property
  declare nextAttemptAt: CreationOptional<number | null>;
  // Last attempt at property
  declare lastAttemptAt: CreationOptional<number | null>;
  // Delivered at property
  declare deliveredAt: CreationOptional<number | null>;
  // Last error property
  declare lastError: CreationOptional<string | null>;
  // Payload property
  declare payload: CreationOptional<string | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

NotificationDelivery.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    alertTriggerId: { type: DataTypes.STRING, allowNull: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    channel: { type: DataTypes.STRING, allowNull: false },
    destination: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 4 },
    nextAttemptAt: { type: DataTypes.BIGINT, allowNull: true },
    lastAttemptAt: { type: DataTypes.BIGINT, allowNull: true },
    deliveredAt: { type: DataTypes.BIGINT, allowNull: true },
    lastError: { type: DataTypes.STRING, allowNull: true },
    payload: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'NotificationDelivery',
    tableName: 'notification_deliveries',
    indexes: [
      { fields: ['status', 'next_attempt_at'] },
      { fields: ['user_id', 'created_at'] },
    ],
  }
);
