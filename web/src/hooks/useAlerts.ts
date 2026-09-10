'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  clearAlertTriggers,
  createAlertRule,
  deleteAlertRule,
  fetchAlertRules,
  fetchAlertTriggers,
  markAlertTriggerRead,
  testAlertRule,
  updateAlertRule,
} from '@/lib/api';
import { UNREAD_ALERT_LIMIT } from '@/lib/constants';
import type { ActionResult, AlertRule, AlertTrigger } from '@/types/index';

export interface UseAlertsResult {
  alertRules: AlertRule[];
  alertTriggers: AlertTrigger[];
  addAlertTrigger: (trigger: AlertTrigger) => void;
  handleSaveAlertRule: (rule: Partial<AlertRule>) => Promise<ActionResult>;
  handleDeleteAlertRule: (id: string) => Promise<void>;
  handleMarkAlertRead: (id: string) => Promise<void>;
  handleClearAlertTriggers: () => Promise<void>;
  handleTestSimulation: (rule: Partial<AlertRule>, onDelivered?: () => void) => Promise<ActionResult>;
}

/**
 * Alert rules + triggers state. Self-loads when enabled.
 *
 * `onPlanLimit` is called when the backend returns a plan-limit error so the
 * calling layer can open the pricing modal. `handleTestSimulation` accepts an
 * optional `onDelivered` callback (e.g. to play a notification sound).
 */
export function useAlerts(
  enabled: boolean,
  onPlanLimit: (resource: string) => void,
): UseAlertsResult {
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertTriggers, setAlertTriggers] = useState<AlertTrigger[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.allSettled([
      fetchAlertRules().then((d) => !cancelled && setAlertRules(d)),
      fetchAlertTriggers().then((d) => !cancelled && setAlertTriggers(d)),
    ]);
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const addAlertTrigger = useCallback((trigger: AlertTrigger) => {
    setAlertTriggers((prev) => [trigger, ...prev].slice(0, UNREAD_ALERT_LIMIT));
  }, []);

  const handleSaveAlertRule = useCallback(
    async (rule: Partial<AlertRule>): Promise<ActionResult> => {
      try {
        if (rule.id) {
          const updated = await updateAlertRule(rule.id, rule);
          setAlertRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        } else {
          const created = await createAlertRule(rule);
          setAlertRules((prev) => [...prev, created]);
        }
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiError && err.planLimit) {
          onPlanLimit(err.planLimit.resource);
          return { ok: false, error: err.planLimit.resource };
        }
        return { ok: false, error: err instanceof Error ? err.message : 'Failed to save alert rule' };
      }
    },
    [onPlanLimit],
  );

  const handleDeleteAlertRule = useCallback(async (id: string): Promise<void> => {
    try {
      await deleteAlertRule(id);
      setAlertRules((prev) => prev.filter((rule) => rule.id !== id));
    } catch (err) {
      console.error('Alert rule delete failed:', err);
    }
  }, []);

  const handleMarkAlertRead = useCallback(async (id: string): Promise<void> => {
    setAlertTriggers((prev) => prev.map((t) => (t.id === id ? { ...t, read: true } : t)));
    try {
      await markAlertTriggerRead(id, true);
    } catch (err) {
      console.error('Mark alert read failed:', err);
    }
  }, []);

  const handleClearAlertTriggers = useCallback(async (): Promise<void> => {
    setAlertTriggers([]);
    try {
      await clearAlertTriggers();
    } catch (err) {
      console.error('Clear alerts failed:', err);
    }
  }, []);

  const handleTestSimulation = useCallback(
    async (rule: Partial<AlertRule>, onDelivered?: () => void): Promise<ActionResult> => {
      try {
        const res = await testAlertRule(rule);
        if (res.delivered) onDelivered?.();
        return { ok: res.delivered, error: res.delivered ? undefined : 'Alert test could not be delivered' };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Alert test failed' };
      }
    },
    [],
  );

  return {
    alertRules,
    alertTriggers,
    addAlertTrigger,
    handleSaveAlertRule,
    handleDeleteAlertRule,
    handleMarkAlertRead,
    handleClearAlertTriggers,
    handleTestSimulation,
  };
}