import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  deleted account (tombstone — prevents re-registration of a permanently deleted email)
export class DeletedAccount extends Model<InferAttributes<DeletedAccount>, InferCreationAttributes<DeletedAccount>> {
  // Id property
  declare id: CreationOptional<string>;
  // Email property
  declare email: CreationOptional<string>;
  // Deleted at property
  declare deletedAt: CreationOptional<number | null>;
}

DeletedAccount.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    deletedAt: { type: DataTypes.BIGINT, allowNull: true, field: 'deleted_at' },
  },
  {
    sequelize,
    modelName: 'DeletedAccount',
    tableName: 'deleted_accounts',
  }
);
