import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  wall history
export class WallHistory extends Model<InferAttributes<WallHistory>, InferCreationAttributes<WallHistory>> {
  // Id property
  declare id: CreationOptional<string>;
  // Symbol property
  declare symbol: CreationOptional<string | null>;
  // Exchange property
  declare exchange: CreationOptional<string | null>;
  // Market type property
  declare marketType: CreationOptional<string | null>;
  // Side property
  declare side: CreationOptional<string | null>;
  // Price property
  declare price: CreationOptional<number | null>;
  // Volume usd property
  declare volumeUsd: CreationOptional<number | null>;
  // Reference price property
  declare referencePrice: CreationOptional<number | null>;
  // Distance percent property
  declare distancePercent: CreationOptional<number | null>;
  // First seen at property
  declare firstSeenAt: CreationOptional<number | null>;
  // Last seen at property
  declare lastSeenAt: CreationOptional<number | null>;
  // Duration seconds property
  declare durationSeconds: CreationOptional<number | null>;
  // Final state property
  declare finalState: CreationOptional<string | null>;
  // Fill percentage property
  declare fillPercentage: CreationOptional<number | null>;
  // Peak volume usd property
  declare peakVolumeUsd: CreationOptional<number | null>;
  // Is aggregated property
  declare isAggregated: CreationOptional<number>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

WallHistory.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    symbol: { type: DataTypes.STRING, allowNull: true },
    exchange: { type: DataTypes.STRING, allowNull: true },
    marketType: { type: DataTypes.STRING, allowNull: true },
    side: { type: DataTypes.STRING, allowNull: true },
    price: { type: DataTypes.FLOAT, allowNull: true },
    volumeUsd: { type: DataTypes.FLOAT, allowNull: true },
    referencePrice: { type: DataTypes.FLOAT, allowNull: true },
    distancePercent: { type: DataTypes.FLOAT, allowNull: true },
    firstSeenAt: { type: DataTypes.BIGINT, allowNull: true },
    lastSeenAt: { type: DataTypes.BIGINT, allowNull: true },
    durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
    finalState: { type: DataTypes.STRING, allowNull: true },
    fillPercentage: { type: DataTypes.FLOAT, allowNull: true },
    peakVolumeUsd: { type: DataTypes.FLOAT, allowNull: true },
    isAggregated: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'WallHistory',
    tableName: 'wall_history',
    indexes: [
      { fields: ['symbol', 'exchange', 'created_at'] },
    ],
  }
);