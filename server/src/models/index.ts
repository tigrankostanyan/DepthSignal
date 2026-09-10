import { User } from './User.js';
import { Session } from './Session.js';
import { AuditLog } from './AuditLog.js';
import { UserSettings } from './UserSettings.js';
import { Watchlist } from './Watchlist.js';
import { WatchlistItem } from './WatchlistItem.js';
import { SavedFilterPreset } from './SavedFilterPreset.js';
import { AlertRule } from './AlertRule.js';
import { AlertTrigger } from './AlertTrigger.js';
import { DetectedWall } from './DetectedWall.js';
import { WallHistory } from './WallHistory.js';
import { DailyWallAggregate } from './DailyWallAggregate.js';
import { BlacklistEntry } from './BlacklistEntry.js';
import { Subscription } from './Subscription.js';
import { BillingEvent } from './BillingEvent.js';
import { BillingWebhookEvent } from './BillingWebhookEvent.js';
import { NotificationDelivery } from './NotificationDelivery.js';
import { PaymentProof } from './PaymentProof.js';
import { TelegramLinkToken } from './TelegramLinkToken.js';
import { UserTelegramLink } from './UserTelegramLink.js';
import { DeletedAccount } from './DeletedAccount.js';


// ── User ────────────────────────────────────────────────────────────────
User.hasMany(Session, { foreignKey: 'userId', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(UserSettings, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserSettings.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Watchlist, { foreignKey: 'userId', onDelete: 'CASCADE' });
Watchlist.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(SavedFilterPreset, { foreignKey: 'userId', onDelete: 'CASCADE' });
SavedFilterPreset.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(AlertRule, { foreignKey: 'userId', onDelete: 'CASCADE' });
AlertRule.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(AlertTrigger, { foreignKey: 'userId', onDelete: 'CASCADE' });
AlertTrigger.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(AuditLog, { foreignKey: 'userId', onDelete: 'CASCADE' });
AuditLog.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(Subscription, { foreignKey: 'userId', onDelete: 'CASCADE' });
Subscription.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(BillingEvent, { foreignKey: 'userId', onDelete: 'CASCADE' });
BillingEvent.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(PaymentProof, { foreignKey: 'userId', onDelete: 'CASCADE' });
PaymentProof.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(TelegramLinkToken, { foreignKey: 'userId', onDelete: 'CASCADE' });
TelegramLinkToken.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(UserTelegramLink, { foreignKey: 'userId', onDelete: 'CASCADE' });
UserTelegramLink.belongsTo(User, { foreignKey: 'userId' });

// ── Watchlist ───────────────────────────────────────────────────────────
Watchlist.hasMany(WatchlistItem, { foreignKey: 'watchlistId', onDelete: 'CASCADE' });
WatchlistItem.belongsTo(Watchlist, { foreignKey: 'watchlistId' });

// ── Alert ───────────────────────────────────────────────────────────────
AlertRule.hasMany(AlertTrigger, { foreignKey: 'ruleId', onDelete: 'CASCADE' });
AlertTrigger.belongsTo(AlertRule, { foreignKey: 'ruleId' });

AlertTrigger.hasMany(NotificationDelivery, { foreignKey: 'alertTriggerId', onDelete: 'CASCADE' });
NotificationDelivery.belongsTo(AlertTrigger, { foreignKey: 'alertTriggerId' });

export {
  User,
  Session,
  AuditLog,
  UserSettings,
  Watchlist,
  WatchlistItem,
  SavedFilterPreset,
  AlertRule,
  AlertTrigger,
  DetectedWall,
  WallHistory,
  DailyWallAggregate,
  BlacklistEntry,
  Subscription,
  BillingEvent,
  BillingWebhookEvent,
  NotificationDelivery,
  PaymentProof,
  TelegramLinkToken,
  UserTelegramLink,
  DeletedAccount,
};
