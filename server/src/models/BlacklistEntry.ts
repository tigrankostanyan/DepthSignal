import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  blacklist entry
export class BlacklistEntry extends Model<InferAttributes<BlacklistEntry>, InferCreationAttributes<BlacklistEntry>> {
  // Id property
  declare id: CreationOptional<string>;
  // Symbol property
  declare symbol: CreationOptional<string | null>;
  // Exchange property
  declare exchange: CreationOptional<string | null>;
  // Category property
  declare category: CreationOptional<string | null>;
  // Reason property
  declare reason: CreationOptional<string | null>;
  // Added at property
  declare addedAt: CreationOptional<number | null>;
}

BlacklistEntry.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    symbol: { type: DataTypes.STRING, allowNull: true },
    exchange: { type: DataTypes.STRING, allowNull: true },
    category: { type: DataTypes.STRING, allowNull: true },
    reason: { type: DataTypes.STRING, allowNull: true },
    addedAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'BlacklistEntry',
    tableName: 'blacklist_entries',
  }
);