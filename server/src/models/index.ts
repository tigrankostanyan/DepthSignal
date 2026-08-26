// ==========================================
// SEQUELIZE MODELS INDEX
// Model Associations & Exports
// ==========================================

import { User } from './User.js';
import { UserSession } from './UserSession.js';
import { AlertRule, Watchlist } from './trading/index.js';

// User Associations
User.hasMany(UserSession, { foreignKey: 'userId', as: 'sessions', onDelete: 'CASCADE' });
UserSession.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(AlertRule, { foreignKey: 'userId', as: 'alertRules', onDelete: 'CASCADE' });
AlertRule.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Watchlist, { foreignKey: 'userId', as: 'watchlists', onDelete: 'CASCADE' });
Watchlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export {
  User,
  UserSession,
  AlertRule,
  Watchlist
};
