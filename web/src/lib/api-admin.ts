// ==========================================
// ADMIN API
// ==========================================

import { authFetch } from './api-core';

export interface AdminUserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  plan: string;
  status: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  planDistribution: Record<string, number>;
  activeWsClients: number;
  failedDeliveriesCount: number;
}

export interface DeliveryLogRow {
  id: string;
  userId: string;
  email: string;
  channel: string;
  event: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  error?: string;
  createdAt: string;
}

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  return authFetch<AdminUserRow[]>('/api/admin/users');
}

export async function adminUpdateUserPlan(
  userId: string,
  plan: string,
  status = 'active',
): Promise<{ status: string }> {
  return authFetch<{ status: string }>(`/api/admin/users/${userId}/plan`, {
    method: 'POST',
    body: JSON.stringify({ plan, status }),
  });
}

export async function adminUpdateUserRole(
  userId: string,
  role: 'TRADER' | 'ADMIN' | 'USER',
): Promise<{ status: string }> {
  return authFetch<{ status: string }>(`/api/admin/users/${userId}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export async function fetchAdminDeliveries(status?: string): Promise<DeliveryLogRow[]> {
  const params = status ? `?status=${status}` : '';
  const json = await authFetch<{ count: number; data: DeliveryLogRow[] }>(`/api/admin/notifications/deliveries${params}`);
  return json.data || [];
}

export async function retryDelivery(id: string): Promise<void> {
  await authFetch(`/api/admin/notifications/${id}/retry`, { method: 'POST' });
}

export async function fetchAdminStats(): Promise<AdminStats> {
  return authFetch<AdminStats>('/api/admin/stats');
}

// ── Payment receipts (manual QR proofs) ────────────────────────────────

export interface AdminPaymentProofRow {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  plan: string;
  interval: 'monthly' | 'yearly';
  amountUsd: number;
  currency: string;
  imageData: string;
  mimeType: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}

export async function fetchAdminPaymentProofs(): Promise<AdminPaymentProofRow[]> {
  return authFetch<AdminPaymentProofRow[]>('/api/admin/receipts');
}

export async function adminActivateReceipt(id: string): Promise<{ status: string }> {
  return authFetch<{ status: string }>(`/api/admin/receipts/${id}/activate`, { method: 'POST' });
}

export async function adminRejectReceipt(id: string): Promise<{ status: string }> {
  return authFetch<{ status: string }>(`/api/admin/receipts/${id}/reject`, { method: 'POST' });
}
