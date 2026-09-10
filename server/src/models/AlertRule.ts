import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  alert rule
export class AlertRule extends Model<InferAttributes<AlertRule>, InferCreationAttributes<AlertRule>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string | null>;
  // Name property
  declare name: CreationOptional<string | null>;
  // Enabled property
  declare enabled: CreationOptional<number>;
  // Symbols property
  declare symbols: CreationOptional<string | null>;
  // Exchanges property
  declare exchanges: CreationOptional<string | null>;
  // Market types property
  declare marketTypes: CreationOptional<string | null>;
  // Logic property
  declare logic: CreationOptional<string>;
  // Conditions json property
  declare conditionsJson: CreationOptional<string | null>;
  // Cooldown seconds property
  declare cooldownSeconds: CreationOptional<number>;
  // Last triggered at property
  declare lastTriggeredAt: CreationOptional<number | null>;
  // Notify channels property
  declare notifyChannels: CreationOptional<string>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
  // Updated at property
  declare updatedAt: CreationOptional<number | null>;
}

AlertRule.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    enabled: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    symbols: { type: DataTypes.STRING, allowNull: true },
    exchanges: { type: DataTypes.STRING, allowNull: true },
    marketTypes: { type: DataTypes.STRING, allowNull: true },
    logic: { type: DataTypes.STRING, allowNull: false, defaultValue: 'AND' },
    conditionsJson: { type: DataTypes.TEXT, allowNull: true },
    cooldownSeconds: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 300 },
    lastTriggeredAt: { type: DataTypes.BIGINT, allowNull: true },
    notifyChannels: { type: DataTypes.STRING, allowNull: false, defaultValue: 'IN_APP' },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AlertRule',
    tableName: 'alert_rules',
  }
);
