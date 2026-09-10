import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  billing webhook event
export class BillingWebhookEvent extends Model<InferAttributes<BillingWebhookEvent>, InferCreationAttributes<BillingWebhookEvent>> {
  // Event id property
  declare eventId: CreationOptional<string>;
  // Provider property
  declare provider: CreationOptional<string>;
  // Event type property
  declare eventType: CreationOptional<string>;
  // Payload hash property
  declare payloadHash: CreationOptional<string | null>;
  // Processed at property
  declare processedAt: CreationOptional<number | null>;
  // Status property
  declare status: CreationOptional<string | null>;
}

BillingWebhookEvent.init(
  {
    eventId: { type: DataTypes.STRING, primaryKey: true },
    provider: { type: DataTypes.STRING, allowNull: false },
    eventType: { type: DataTypes.STRING, allowNull: false },
    payloadHash: { type: DataTypes.STRING, allowNull: true },
    processedAt: { type: DataTypes.BIGINT, allowNull: true },
    status: { type: DataTypes.STRING, allowNull: true },
  },
  {
    sequelize,
    modelName: 'BillingWebhookEvent',
    tableName: 'billing_webhook_events',
  }
);
