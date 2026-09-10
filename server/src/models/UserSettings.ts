import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  user settings
export class UserSettings extends Model<InferAttributes<UserSettings>, InferCreationAttributes<UserSettings>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string | null>;
  // Theme property
  declare theme: CreationOptional<string>;
  // Decimal precision property
  declare decimalPrecision: CreationOptional<number>;
  // Currency property
  declare currency: CreationOptional<string>;
  // Refresh rate ms property
  declare refreshRateMs: CreationOptional<number>;
  // Default preset id property
  declare defaultPresetId: CreationOptional<string | null>;
  // Default cross exchange aggregation property
  declare defaultCrossExchangeAggregation: CreationOptional<number>;
  // Wall min volume default usd property
  declare wallMinVolumeDefaultUsd: CreationOptional<number>;
  // Wall min duration default sec property
  declare wallMinDurationDefaultSec: CreationOptional<number>;
  // Wall distance default percent property
  declare wallDistanceDefaultPercent: CreationOptional<number>;
  // Enabled exchanges property
  declare enabledExchanges: CreationOptional<string>;
  // Sound enabled property
  declare soundEnabled: CreationOptional<number>;
  // Telegram bot token property
  declare telegramBotToken: CreationOptional<string | null>;
  // Telegram chat id property
  declare telegramChatId: CreationOptional<string | null>;
  // Email recipient property
  declare emailRecipient: CreationOptional<string | null>;
  // Webhook url property
  declare webhookUrl: CreationOptional<string | null>;
  // Finnhub api key property
  declare finnhubApiKey: CreationOptional<string | null>;
  // Polygon api key property
  declare polygonApiKey: CreationOptional<string | null>;
  // Updated at property
  declare updatedAt: CreationOptional<number | null>;
}

UserSettings.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, unique: true, allowNull: true },
    theme: { type: DataTypes.STRING, allowNull: false, defaultValue: 'dark' },
    decimalPrecision: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 2 },
    currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
    refreshRateMs: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1000 },
    defaultPresetId: { type: DataTypes.STRING, allowNull: true },
    defaultCrossExchangeAggregation: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    wallMinVolumeDefaultUsd: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 500000 },
    wallMinDurationDefaultSec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 15 },
    wallDistanceDefaultPercent: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 2.5 },
    enabledExchanges: { type: DataTypes.STRING, allowNull: false, defaultValue: 'BINANCE,BYBIT,OKX,MEXC' },
    soundEnabled: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    telegramBotToken: { type: DataTypes.STRING, allowNull: true },
    telegramChatId: { type: DataTypes.STRING, allowNull: true },
    emailRecipient: { type: DataTypes.STRING, allowNull: true },
    webhookUrl: { type: DataTypes.STRING, allowNull: true },
    finnhubApiKey: { type: DataTypes.STRING, allowNull: true },
    polygonApiKey: { type: DataTypes.STRING, allowNull: true },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'UserSettings',
    tableName: 'user_settings',
  }
);
