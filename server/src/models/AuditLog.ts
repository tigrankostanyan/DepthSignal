import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  audit log
export class AuditLog extends Model<InferAttributes<AuditLog>, InferCreationAttributes<AuditLog>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string | null>;
  // Action property
  declare action: CreationOptional<string | null>;
  // Resource property
  declare resource: CreationOptional<string | null>;
  // Resource id property
  declare resourceId: CreationOptional<string | null>;
  // Details json property
  declare detailsJson: CreationOptional<string | null>;
  // Ip address property
  declare ipAddress: CreationOptional<string | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

AuditLog.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: true },
    action: { type: DataTypes.STRING, allowNull: true },
    resource: { type: DataTypes.STRING, allowNull: true },
    resourceId: { type: DataTypes.STRING, allowNull: true },
    detailsJson: { type: DataTypes.TEXT, allowNull: true },
    ipAddress: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'AuditLog',
    tableName: 'audit_logs',
  }
);
