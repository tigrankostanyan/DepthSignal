import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  billing event
export class BillingEvent extends Model<InferAttributes<BillingEvent>, InferCreationAttributes<BillingEvent>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string>;
  // Event type property
  declare eventType: CreationOptional<string>;
  // Plan property
  declare plan: CreationOptional<string | null>;
  // Provider property
  declare provider: CreationOptional<string>;
  // Details property
  declare details: CreationOptional<string | null>;
  // Ip address property
  declare ipAddress: CreationOptional<string | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

BillingEvent.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    eventType: { type: DataTypes.STRING, allowNull: false },
    plan: { type: DataTypes.STRING, allowNull: true },
    provider: { type: DataTypes.STRING, allowNull: false },
    details: { type: DataTypes.TEXT, allowNull: true },
    ipAddress: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'BillingEvent',
    tableName: 'billing_events',
    indexes: [
      { fields: ['user_id', 'created_at'] },
    ],
  }
);