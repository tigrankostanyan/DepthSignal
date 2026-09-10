import { authFetch } from './api-core';
export interface UserDataExport {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: number;
  };
  settings: any;
  watchlists: any[];
  alertRules: any[];
  alertTriggers: any[];
  subscription: any;
  billingEvents: any[];
  auditLogs: any[];
  telegramLink: any;
}

export async function exportUserData(): Promise<UserDataExport> {
  return authFetch<UserDataExport>('/api/user/export');
}

export async function deleteUserAccount(confirm: 'DELETE'): Promise<{ status: string; message: string }> {
  return authFetch<{ status: string; message: string }>('/api/user/me', {
    method: 'DELETE',
    body: JSON.stringify({ confirm }),
  });
}