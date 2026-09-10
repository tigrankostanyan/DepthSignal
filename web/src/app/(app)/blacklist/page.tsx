'use client';

import React from 'react';
import { BlacklistManager } from '@/components/Blacklist/BlacklistManager';
import { useApp } from '@/providers/AppProviders';
import type { BlacklistEntry } from '@/types/index';

export default function BlacklistPage() {
  const { blacklist, handleAddBlacklist, handleRemoveBlacklist } = useApp();

  // BlacklistManager expects a void promise; discard the ActionResult
  const handleAddEntryVoid = async (entry: Omit<BlacklistEntry, 'id' | 'addedAt'>) => {
    await handleAddBlacklist(entry);
  };

  return (
    <BlacklistManager
      entries={blacklist}
      onAddEntry={handleAddEntryVoid}
      onRemoveEntry={handleRemoveBlacklist}
    />
  );
}
