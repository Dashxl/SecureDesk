import React from 'react';

export function Avatar({ src, name, className = '' }: { src?: string | null; name: string; className?: string }) {
  if (src) {
    return <img src={src} alt={name} className={`h-8 w-8 rounded-full border border-surface-400 ${className}`} />;
  }
  
  const initials = name.substring(0, 2).toUpperCase();
  return (
    <div className={`h-8 w-8 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold ${className}`}>
      {initials}
    </div>
  );
}
