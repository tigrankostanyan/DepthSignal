import { TelegramLinkToken } from '../models/TelegramLinkToken.js';
import { UserTelegramLink } from '../models/UserTelegramLink.js';

//  telegram repository
export class TelegramRepository {
  // ── Link tokens ───────────────────────────────────────────────────────

  // Create token
  async createToken(data: { id: string; userId: string; tokenHash: string; expiresAt: number }): Promise<TelegramLinkToken> {
    return TelegramLinkToken.create({ ...data, createdAt: Date.now() } as any);
  }

  // Find token by hash
  async findTokenByHash(tokenHash: string): Promise<TelegramLinkToken | null> {
    // Original sql.js semantics: return the token row regardless of
    // used/expiry state; the service layer decides validity.
    return TelegramLinkToken.findOne({ where: { tokenHash } });
  }

  // Mark token used
  async markTokenUsed(id: string): Promise<void> {
    await TelegramLinkToken.update({ usedAt: Date.now() }, { where: { id } });
  }

  // ── User links ────────────────────────────────────────────────────────

  // Find by user
  async findByUser(userId: string): Promise<UserTelegramLink | null> {
    return UserTelegramLink.findByPk(userId);
  }

  // Find by telegram user id
  async findByTelegramUserId(telegramUserId: string): Promise<UserTelegramLink | null> {
    return UserTelegramLink.findOne({ where: { telegramUserId } });
  }

  // Find by chat id
  async findByChatId(chatId: string): Promise<UserTelegramLink | null> {
    return UserTelegramLink.findOne({ where: { telegramChatId: chatId } });
  }

  // Upsert link
  async upsertLink(data: { userId: string; telegramChatId: string; telegramUserId: string; telegramUsername?: string; enabled?: boolean | number }): Promise<UserTelegramLink> {
    const now = Date.now();
    const existing = await this.findByUser(data.userId);
    if (existing) {
      await UserTelegramLink.update({ ...data, updatedAt: now } as any, { where: { userId: data.userId } });
      return (await this.findByUser(data.userId))!;
    }
    return UserTelegramLink.create({ ...data, linkedAt: now, updatedAt: now } as any);
  }

  // Delete
  async delete(userId: string): Promise<void> {
    await UserTelegramLink.destroy({ where: { userId } });
  }
}