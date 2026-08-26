export interface AlertRuleDTO {
  id: string;
  name: string;
  symbol: string;
  exchange: string;
  marketType: 'SPOT' | 'FUTURES';
  conditionType: string;
  targetPrice?: number;
  targetVolume?: number;
  minWallUsd?: number;
  channels: ('IN_APP' | 'TELEGRAM' | 'EMAIL' | 'WEBHOOK')[];
  status: 'ACTIVE' | 'PAUSED' | 'TRIGGERED';
  cooldownMinutes: number;
  lastTriggeredAt?: number;
  createdAt: number;
}
