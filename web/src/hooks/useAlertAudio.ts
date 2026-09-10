'use client';

import { useCallback, useEffect, useRef } from 'react';
import { playAlertSound, unlockAudio } from '@/lib/audio';

/**
 * Manages the alert sound: unlocks the AudioContext on the first user gesture
 * (browser autoplay policy) and exposes a guarded play function that respects
 * the current sound-enabled setting.
 */
export function useAlertAudio(soundEnabled: boolean): () => void {
  const soundEnabledRef = useRef(soundEnabled);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  // Unlock audio on first user gesture (browser autoplay policy)
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return useCallback(() => {
    if (soundEnabledRef.current) playAlertSound();
  }, []);
}
