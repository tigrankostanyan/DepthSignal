'use client';

import { useCallback, useEffect, useState } from 'react';
import { updateUserSettings } from '@/lib/api';
import type { UserProfile } from '@/types/index';

export type AppTheme = 'dark';

/** Strictly enforces dark theme on <html> and removes any residual light classes. */
export function applyThemeClass(_theme?: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.remove('light');
  document.documentElement.classList.add('dark');
  try {
    localStorage.removeItem('theme');
    localStorage.setItem('theme', 'dark');
  } catch {}
}

export interface UseThemeResult {
  theme: AppTheme;
  setTheme: React.Dispatch<React.SetStateAction<AppTheme>>;
  toggleTheme: () => void;
}

/**
 * Terminal theme hook locked permanently to Institutional Dark Mode.
 */
export function useTheme(user: UserProfile | null): UseThemeResult {
  const [theme, setTheme] = useState<AppTheme>('dark');

  useEffect(() => {
    applyThemeClass('dark');
  }, []);

  const toggleTheme = useCallback(() => {
    // Locked to dark mode - enforce dark mode and fix any lingering settings
    applyThemeClass('dark');
    if (user) {
      updateUserSettings({ theme: 'dark' }).catch(() => {});
    }
  }, [user]);

  return { theme: 'dark', setTheme, toggleTheme };
}
