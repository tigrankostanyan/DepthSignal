import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  watchlist
export class Watchlist extends Model<InferAttributes<Watchlist>, InferCreationAttributes<Watchlist>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string | null>;
  // Name property
  declare name: CreationOptional<string | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

Watchlist.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Watchlist',
    tableName: 'watchlists',
  }
);
