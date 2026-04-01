import React from 'react';

export function Card({ children, className = '', hoverable = false }: { children: React.ReactNode; className?: string; hoverable?: boolean }) {
  return (
    <div className={`${hoverable ? 'glass-card-hover' : 'glass-card'} p-6 ${className}`}>
      {children}
    </div>
  );
}
