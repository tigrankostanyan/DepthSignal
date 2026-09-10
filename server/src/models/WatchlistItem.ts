import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  watchlist item
export class WatchlistItem extends Model<InferAttributes<WatchlistItem>, InferCreationAttributes<WatchlistItem>> {
  // Id property
  declare id: CreationOptional<string>;
  // Watchlist id property
  declare watchlistId: CreationOptional<string | null>;
  // Symbol property
  declare symbol: CreationOptional<string | null>;
  // Exchange property
  declare exchange: CreationOptional<string | null>;
  // Market type property
  declare marketType: CreationOptional<string | null>;
  // Notes property
  declare notes: CreationOptional<string | null>;
  // Added at property
  declare addedAt: CreationOptional<number | null>;
}

WatchlistItem.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    watchlistId: { type: DataTypes.STRING, allowNull: true },
    symbol: { type: DataTypes.STRING, allowNull: true },
    exchange: { type: DataTypes.STRING, allowNull: true },
    marketType: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.STRING, allowNull: true },
    addedAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'WatchlistItem',
    tableName: 'watchlist_items',
    indexes: [
      {
        unique: true,
        fields: ['watchlist_id', 'symbol', 'exchange', 'market_type'],
      },
    ],
  }
);
