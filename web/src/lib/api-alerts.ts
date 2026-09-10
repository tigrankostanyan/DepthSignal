// ==========================================
// ALERTS API
// ==========================================

import type { AlertRule, AlertTrigger } from '@/types/index';
import { authFetch, safeFetch } from './api-core';

export async function fetchAlertRules(): Promise<AlertRule[]> {
  return safeFetch<AlertRule[]>('/api/alerts/rules', undefined, []);
}

export async function createAlertRule(rule: Partial<AlertRule>): Promise<AlertRule> {
  return authFetch<AlertRule>('/api/alerts/rules', {
    method: 'POST',
    body: JSON.stringify(rule),
  });
}

export async function updateAlertRule(id: string, patch: Partial<AlertRule>): Promise<AlertRule> {
  // Backend upserts via POST with body.id
  return authFetch<AlertRule>('/api/alerts/rules', {
    method: 'POST',
    body: JSON.stringify({ ...patch, id }),
  });
}

export async function deleteAlertRule(id: string): Promise<void> {
  await authFetch(`/api/alerts/rules/${id}`, { method: 'DELETE' });
}

export async function fetchAlertTriggers(limit = 100): Promise<AlertTrigger[]> {
  return safeFetch<AlertTrigger[]>(`/api/alerts/triggers?limit=${limit}`, undefined, []);
}

export async function markAlertTriggerRead(id: string, read = true): Promise<void> {
  await authFetch('/api/alerts/triggers/read', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function clearAlertTriggers(): Promise<void> {
  await authFetch('/api/alerts/triggers', { method: 'DELETE' });
}

export async function testAlertRule(_rule?: Partial<AlertRule>): Promise<{ delivered: boolean }> {
  const trigger = await authFetch<AlertTrigger>('/api/alerts/test-trigger', { method: 'POST' });
  return { delivered: Boolean(trigger) };
}
