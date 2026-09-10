import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  daily wall aggregate
export class DailyWallAggregate extends Model<InferAttributes<DailyWallAggregate>, InferCreationAttributes<DailyWallAggregate>> {
  // Id property
  declare id: CreationOptional<string>;
  // Date property
  declare date: CreationOptional<string | null>;
  // Symbol property
  declare symbol: CreationOptional<string | null>;
  // Exchange property
  declare exchange: CreationOptional<string | null>;
  // Market type property
  declare marketType: CreationOptional<string | null>;
  // Wall count property
  declare wallCount: CreationOptional<number>;
  // Bid wall count property
  declare bidWallCount: CreationOptional<number>;
  // Ask wall count property
  declare askWallCount: CreationOptional<number>;
  // Avg volume usd property
  declare avgVolumeUsd: CreationOptional<number>;
  // Peak volume usd property
  declare peakVolumeUsd: CreationOptional<number>;
  // Avg duration seconds property
  declare avgDurationSeconds: CreationOptional<number>;
  // Filled count property
  declare filledCount: CreationOptional<number>;
  // Removed count property
  declare removedCount: CreationOptional<number>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

DailyWallAggregate.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    date: { type: DataTypes.STRING, allowNull: true },
    symbol: { type: DataTypes.STRING, allowNull: true },
    exchange: { type: DataTypes.STRING, allowNull: true },
    marketType: { type: DataTypes.STRING, allowNull: true },
    wallCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    bidWallCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    askWallCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    avgVolumeUsd: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    peakVolumeUsd: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    avgDurationSeconds: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    filledCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    removedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'DailyWallAggregate',
    tableName: 'daily_wall_aggregates',
    indexes: [
      {
        unique: true,
        fields: ['date', 'symbol', 'exchange', 'market_type'],
      },
    ],
  }
);
