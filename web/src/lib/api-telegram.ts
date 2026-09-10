// ==========================================
// TELEGRAM API
// ==========================================

import type {
  TelegramStatusResponse,
  TelegramLinkTokenResponse,
  TelegramTestAlertResponse,
} from '@/types/index';
import { authFetch } from './api-core';

export async function fetchTelegramStatus(): Promise<TelegramStatusResponse> {
  return authFetch<TelegramStatusResponse>('/api/telegram/status');
}

export async function createTelegramLinkToken(): Promise<TelegramLinkTokenResponse> {
  return authFetch<TelegramLinkTokenResponse>('/api/telegram/link-token', { method: 'POST' });
}

export async function sendTelegramTestAlert(): Promise<TelegramTestAlertResponse> {
  return authFetch<TelegramTestAlertResponse>('/api/telegram/test-alert', { method: 'POST' });
}

export async function disconnectTelegram(): Promise<{ success: boolean; message: string }> {
  return authFetch<{ success: boolean; message: string }>('/api/telegram/disconnect', { method: 'POST' });
}
