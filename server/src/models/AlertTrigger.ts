import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  alert trigger
export class AlertTrigger extends Model<InferAttributes<AlertTrigger>, InferCreationAttributes<AlertTrigger>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string | null>;
  // Rule id property
  declare ruleId: CreationOptional<string | null>;
  // Rule name property
  declare ruleName: CreationOptional<string | null>;
  // Symbol property
  declare symbol: CreationOptional<string | null>;
  // Exchange property
  declare exchange: CreationOptional<string | null>;
  // Market type property
  declare marketType: CreationOptional<string | null>;
  // Message property
  declare message: CreationOptional<string | null>;
  // Condition type property
  declare conditionType: CreationOptional<string | null>;
  // Metric value property
  declare metricValue: CreationOptional<string | null>;
  // Trigger price property
  declare triggerPrice: CreationOptional<number | null>;
  // Channel property
  declare channel: CreationOptional<string>;
  // Read property
  declare read: CreationOptional<number>;
  // Timestamp property
  declare timestamp: CreationOptional<number | null>;
}

AlertTrigger.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: true },
    ruleId: { type: DataTypes.STRING, allowNull: true },
    ruleName: { type: DataTypes.STRING, allowNull: true },
    symbol: { type: DataTypes.STRING, allowNull: true },
    exchange: { type: DataTypes.STRING, allowNull: true },
    marketType: { type: DataTypes.STRING, allowNull: true },
    message: { type: DataTypes.STRING, allowNull: true },
    conditionType: { type: DataTypes.STRING, allowNull: true },
    metricValue: { type: DataTypes.STRING, allowNull: true },
    triggerPrice: { type: DataTypes.FLOAT, allowNull: true },
    channel: { type: DataTypes.STRING, allowNull: false, defaultValue: 'IN_APP' },
    read: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    timestamp: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AlertTrigger',
    tableName: 'alert_triggers',
    indexes: [
      { fields: ['user_id', 'timestamp'] },
      { fields: ['symbol', 'timestamp'] },
    ],
  }
);
