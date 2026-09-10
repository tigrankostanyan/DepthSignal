import { DataTypes, Model, InferAttributes, InferCreationAttributes, CreationOptional } from 'sequelize';
import { sequelize } from '../db/sequelize.js';

//  subscription
export class Subscription extends Model<InferAttributes<Subscription>, InferCreationAttributes<Subscription>> {
  // User id property
  declare userId: CreationOptional<string>;
  // Plan property
  declare plan: CreationOptional<string>;
  // Status property
  declare status: CreationOptional<string>;
  // Billing provider property
  declare billingProvider: CreationOptional<string>;
  // External customer id property
  declare externalCustomerId: CreationOptional<string | null>;
  // External subscription id property
  declare externalSubscriptionId: CreationOptional<string | null>;
  // Current period start property
  declare currentPeriodStart: CreationOptional<number | null>;
  // Current period end property
  declare currentPeriodEnd: CreationOptional<number | null>;
  // Cancel at period end property
  declare cancelAtPeriodEnd: CreationOptional<number>;
  // Trial ends at property
  declare trialEndsAt: CreationOptional<number | null>;
  // Created at property
  declare createdAt: CreationOptional<number | null>;
  // Updated at property
  declare updatedAt: CreationOptional<number | null>;
}

Subscription.init(
  {
    userId: { type: DataTypes.STRING, primaryKey: true },
    plan: { type: DataTypes.STRING, allowNull: false, defaultValue: 'FREE' },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' },
    billingProvider: { type: DataTypes.STRING, allowNull: false, defaultValue: 'manual' },
    externalCustomerId: { type: DataTypes.STRING, allowNull: true },
    externalSubscriptionId: { type: DataTypes.STRING, allowNull: true },
    currentPeriodStart: { type: DataTypes.BIGINT, allowNull: true },
    currentPeriodEnd: { type: DataTypes.BIGINT, allowNull: true },
    cancelAtPeriodEnd: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    trialEndsAt: { type: DataTypes.BIGINT, allowNull: true },
    createdAt: { type: DataTypes.BIGINT, allowNull: true },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
  },
  {
    sequelize,
    modelName: 'Subscription',
    tableName: 'subscriptions',
  }
);