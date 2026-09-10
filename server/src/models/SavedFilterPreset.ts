import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  saved filter preset
export class SavedFilterPreset extends Model<InferAttributes<SavedFilterPreset>, InferCreationAttributes<SavedFilterPreset>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string | null>;
  // Name property
  declare name: CreationOptional<string | null>;
  // Is default property
  declare isDefault: CreationOptional<number>;
  // Filters json property
  declare filtersJson: CreationOptional<string | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

SavedFilterPreset.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    isDefault: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    filtersJson: { type: DataTypes.TEXT, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'SavedFilterPreset',
    tableName: 'saved_filter_presets',
  }
);
