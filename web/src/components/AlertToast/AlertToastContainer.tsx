'use client';

import React, { useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useApp, useRealtimeData } from '@/providers/AppProviders';
import type { AlertTrigger } from '@/types/index';
import { formatUsdPrice } from '@/lib/format';

interface ToastItem {
  uid: string;
  trigger: AlertTrigger;
}

const TOAST_DURATION = 5000;

export function AlertToastContainer() {
  const { openSymbolFocus, handleMarkAlertRead } = useApp();
  const { alertTriggers } = useRealtimeData();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const lastCountRef = useRef(alertTriggers.length);

  // Detect newly arrived alert triggers and show them as toasts.
  useEffect(() => {
    const prev = lastCountRef.current;
    const next = alertTriggers.length;
    lastCountRef.current = next;
    if (next <= prev) return;

    const fresh = alertTriggers.slice(0, next - prev).reverse();
    const items: ToastItem[] = fresh.map((t) => ({ uid: `${t.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, trigger: t }));
    setToasts((existing) => [...existing, ...items].slice(-4));

    for (const item of items) {
      setTimeout(() => {
        setToasts((existing) => existing.filter((t) => t.uid !== item.uid));
      }, TOAST_DURATION);
    }
  }, [alertTriggers]);

  const dismiss = (uid: string) => {
    setToasts((existing) => existing.filter((t) => t.uid !== uid));
  };

  const open = (toast: ToastItem) => {
    dismiss(toast.uid);
    handleMarkAlertRead(toast.trigger.id);
    openSymbolFocus(toast.trigger.symbol, toast.trigger.exchange, toast.trigger.marketType);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-14 right-4 z-[9999] flex flex-col items-end space-y-2 w-80 sm:w-96 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.uid}
          className="pointer-events-auto w-full bg-surface border border-divider border-l-2 border-l-[#24C4E8] rounded-lg shadow-2xl overflow-hidden animate-toast-in"
          role="status"
        >
          <div className="flex items-start justify-between p-3 pb-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-accent/20 text-[#24C4E8] flex-none">
                <BellRing size={13} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-[#24C4E8] text-xs">{toast.trigger.symbol}</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-primary text-muted border border-divider font-mono">
                    {toast.trigger.exchange}
                  </span>
                </div>
                <div className="text-[10px] text-muted font-mono mt-0.5">
                  {new Date(toast.trigger.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismiss(toast.uid);
              }}
              className="text-muted hover:text-white transition flex-none p-0.5"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>

          <div
            onClick={() => open(toast)}
            className="px-3 pb-3 pt-0.5 cursor-pointer group"
            title="Click to open symbol analysis"
          >
            <div className="text-main text-xs leading-relaxed mb-1.5 group-hover:underline">
              {toast.trigger.message}
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted">
              <span className="truncate max-w-[180px]">Rule: {toast.trigger.ruleName}</span>
              {toast.trigger.triggerPrice > 0 && (
                <span className="font-mono text-accent font-bold">
                  {formatUsdPrice(toast.trigger.triggerPrice)}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
