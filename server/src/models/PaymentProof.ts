import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  payment proof (manual QR receipt)
export class PaymentProof extends Model<InferAttributes<PaymentProof>, InferCreationAttributes<PaymentProof>> {
  // Id property
  declare id: CreationOptional<string>;
  // User id property
  declare userId: CreationOptional<string>;
  // Plan property
  declare plan: CreationOptional<string>;
  // Interval property
  declare interval: CreationOptional<string>;
  // Amount usd property
  declare amountUsd: CreationOptional<number>;
  // Currency property
  declare currency: CreationOptional<string>;
  // Image data property
  declare imageData: CreationOptional<string>;
  // Mime type property
  declare mimeType: CreationOptional<string>;
  // Note property
  declare note: CreationOptional<string | null>;
  // Status property
  declare status: CreationOptional<string>;
  // Reviewed by property
  declare reviewedBy: CreationOptional<string | null>;
  // Reviewed at property
  declare reviewedAt: CreationOptional<number | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
}

PaymentProof.init(
  {
    id: { type: DataTypes.STRING, primaryKey: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    plan: { type: DataTypes.STRING, allowNull: false },
    interval: { type: DataTypes.STRING, allowNull: false },
    amountUsd: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
    currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
    imageData: { type: DataTypes.TEXT({ length: 'long' }), allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: false },
    note: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
    reviewedBy: { type: DataTypes.STRING, allowNull: true },
    reviewedAt: { type: DataTypes.BIGINT, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'PaymentProof',
    tableName: 'payment_proofs',
    indexes: [{ fields: ['user_id', 'created_at'] }],
  }
);
