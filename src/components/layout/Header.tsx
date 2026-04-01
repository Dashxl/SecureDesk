'use client';

import React from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Avatar } from '../ui/Avatar';

export function Header() {
  const { user, isLoading } = useUser();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-4 bg-surface-50/80 backdrop-blur-xl border-b border-surface-200 lg:hidden text-white">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center font-bold text-lg">
          S
        </div>
        <span className="font-semibold tracking-tight text-white">SecureDesk</span>
      </div>
      
      {!isLoading && user && (
        <a href="/api/auth/logout" className="group">
          <Avatar src={user.picture} name={user.name || 'User'} className="group-hover:ring-2 group-hover:ring-brand-500 transition-all cursor-pointer" />
        </a>
      )}
    </header>
  );
}
