export interface UserProfile {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  tier: 'FREE' | 'PRO' | 'ADVANCED';
  telegramChatId?: string;
  emailRecipient?: string;
  webhookUrl?: string;
}

export interface UserSettingsDTO {
  theme: 'dark' | 'light';
  soundEnabled: boolean;
  minWallUsd: number;
  telegramChatId?: string;
  emailRecipient?: string;
  webhookUrl?: string;
}
