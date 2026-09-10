import React from 'react';

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}

export function FormField({ label, children, hint, className = '' }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-bold text-muted uppercase tracking-wider mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}