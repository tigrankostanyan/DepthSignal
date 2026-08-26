import { apiClient } from './client.js';
import { AlertRuleDTO } from '../../types/alerts.js';

export async function getAlertRules(): Promise<AlertRuleDTO[]> {
  return apiClient<AlertRuleDTO[]>('/api/alerts');
}

export async function createAlertRule(rule: Partial<AlertRuleDTO>): Promise<AlertRuleDTO> {
  return apiClient<AlertRuleDTO>('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(rule)
  });
}

export async function deleteAlertRule(ruleId: string): Promise<{ success: boolean }> {
  return apiClient<{ success: boolean }>(`/api/alerts/${ruleId}`, {
    method: 'DELETE'
  });
}
