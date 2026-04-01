import React, { ReactNode } from 'react';

export function Badge({ children, variant = 'neutral' }: { children: ReactNode; variant?: 'neutral' | 'success' | 'warning' | 'error' | 'brand' }) {
  const classes = {
    neutral: 'bg-surface-300 text-surface-800 border-surface-400',
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    error: 'bg-red-500/10 text-red-500 border-red-500/20',
    brand: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
  }[variant];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${classes}`}>
      {children}
    </span>
  );
}
