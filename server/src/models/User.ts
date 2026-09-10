import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  user
export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  // Id property
  declare id: CreationOptional<string>;
  // Email property
  declare email: CreationOptional<string | null>;
  // Password hash property
  declare passwordHash: CreationOptional<string | null>;
  // Password salt property
  declare passwordSalt: CreationOptional<string | null>;
  // Name property
  declare name: CreationOptional<string | null>;
  // Role property
  declare role: CreationOptional<string>;
  // Trial start date property
  declare trialStartDate: CreationOptional<number | null>;
  // Trial end date property
  declare trialEndDate: CreationOptional<number | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
  // Updated at property
  declare updatedAt: CreationOptional<number | null>;
}

User.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    email: { type: DataTypes.STRING, unique: true, allowNull: true },
    passwordHash: { type: DataTypes.STRING, allowNull: true },
    passwordSalt: { type: DataTypes.STRING, allowNull: true },
    name: { type: DataTypes.STRING, allowNull: true },
    role: { type: DataTypes.ENUM('user', 'trader', 'admin'), allowNull: false, defaultValue: 'user' },
    trialStartDate: { type: DataTypes.BIGINT, allowNull: true, field: 'trial_start_date' },
    trialEndDate: { type: DataTypes.BIGINT, allowNull: true, field: 'trial_end_date' },
    createdAt: { type: DataTypes.BIGINT, allowNull: true, field: 'created_at' },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_at' },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
  }
);
