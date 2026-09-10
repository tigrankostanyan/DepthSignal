'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}

/** Reusable premium modal used for confirmations and text input instead of native browser dialogs. */
export const Modal: React.FC<ModalProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = 'max-w-md',
}) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className={`w-full ${maxWidth} bg-[#0B1E33] border border-divider rounded-xl shadow-2xl overflow-hidden`}>
        <div className="p-4 border-b border-divider flex items-center justify-between">
          <h3 id="modal-title" className="text-sm font-bold text-main">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-muted hover:text-white transition cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {description && <p className="px-4 pt-3 text-xs text-muted leading-relaxed">{description}</p>}

        {children && <div className="p-4">{children}</div>}

        {footer && <div className="p-4 border-t border-divider flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
};
