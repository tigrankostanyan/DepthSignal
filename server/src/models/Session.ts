import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  session
export class Session extends Model<InferAttributes<Session>, InferCreationAttributes<Session>> {
  // Id property
  declare id: CreationOptional<string>;
  // Token hash property
  declare tokenHash: CreationOptional<string | null>;
  // User id property
  declare userId: CreationOptional<string | null>;
  // Expires at property
  declare expiresAt: CreationOptional<number | null>;
  // Ip address property
  declare ipAddress: CreationOptional<string | null>;
  // User agent property
  declare userAgent: CreationOptional<string | null>;
  // Fingerprint hash property (binds the session to a specific client)
  declare fingerprintHash: CreationOptional<string | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
  // Revoked at property
  declare revokedAt: CreationOptional<number | null>;
}

Session.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    tokenHash: { type: DataTypes.STRING, unique: true, allowNull: true },
    userId: { type: DataTypes.STRING, allowNull: true },
    expiresAt: { type: DataTypes.BIGINT, allowNull: true },
    ipAddress: { type: DataTypes.STRING, allowNull: true },
    userAgent: { type: DataTypes.STRING, allowNull: true },
    fingerprintHash: { type: DataTypes.STRING, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
    revokedAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Session',
    tableName: 'sessions',
  }
);
