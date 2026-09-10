'use client';

import React from 'react';
import { AlertManager } from '@/components/Alerts/AlertManager';
import { useApp, useRealtimeData } from '@/providers/AppProviders';
import type { AlertRule } from '@/types/index';

export default function AlertsPage() {
  const {
    alertRules,
    handleSaveAlertRule,
    handleDeleteAlertRule,
    handleMarkAlertRead,
    handleClearAlertTriggers,
    handleTestSimulation,
  } = useApp();
  const { alertTriggers } = useRealtimeData();

  // Legacy AlertManager calls onMarkRead() without an id for "Mark All Read"
  const handleMarkAlertReadAll = async (id?: string) => {
    if (id) {
      await handleMarkAlertRead(id);
    } else {
      for (const trig of alertTriggers) {
        if (!trig.read) {
          try {
            await handleMarkAlertRead(trig.id);
          } catch {
            // ignore per-trigger failures
          }
        }
      }
    }
  };

  // AlertManager expects a void promise; discard the ActionResult
  const handleSaveRuleVoid = async (rule: Partial<AlertRule>) => {
    await handleSaveAlertRule(rule);
  };

  const handleTestSimulationVoid = async () => {
    await handleTestSimulation({});
  };

  return (
    <AlertManager
      rules={alertRules}
      triggers={alertTriggers}
      onSaveRule={handleSaveRuleVoid}
      onDeleteRule={handleDeleteAlertRule}
      onMarkRead={handleMarkAlertReadAll}
      onClearTriggers={handleClearAlertTriggers}
      onTestSimulation={handleTestSimulationVoid}
    />
  );
}
