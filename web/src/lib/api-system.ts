// ==========================================
// SYSTEM / CONNECTOR API
// ==========================================

import type { ConnectorStatus } from '@/types/index';
import { authFetch } from './api-core';

export async function fetchConnectorHealth(): Promise<ConnectorStatus[]> {
  return authFetch<ConnectorStatus[]>('/api/connectors/health');
}

export interface DomainTestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  message: string;
  details?: string;
}

export async function runDomainTests(): Promise<{
  total: number;
  passed: number;
  failed: number;
  results: DomainTestResult[];
}> {
  return authFetch('/api/run-tests');
}
