'use client';

import React from 'react';
import { SettingsView } from '@/components/Settings/SettingsView';
import { useApp } from '@/providers/AppProviders';
import type { UserSettings } from '@/types/index';

export default function SettingsPage() {
  const { settings, connectors, presets, handleSaveSettings, handleRefreshHealth } = useApp();

  if (!settings) {
    return (
      <div className="flex-1 flex items-center justify-center bg-primary">
        <div className="text-xs text-muted">Loading settings...</div>
      </div>
    );
  }

  // SettingsView expects a void promise; discard the ActionResult
  const handleSaveSettingsVoid = async (patch: Partial<UserSettings>) => {
    await handleSaveSettings(patch);
  };

  const handleRefreshHealthVoid = async () => {
    await handleRefreshHealth();
  };

  return (
    <SettingsView
      settings={settings}
      connectors={connectors}
      presets={presets}
      onSaveSettings={handleSaveSettingsVoid}
      onRefreshHealth={handleRefreshHealthVoid}
    />
  );
}