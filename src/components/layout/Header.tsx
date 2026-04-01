'use client';

import React from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Avatar } from '../ui/Avatar';
import Image from 'next/image';
import LogoWordmark from '@/app/img/Logo4.jpg';

export function Header() {
  const { user, isLoading } = useUser();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#11192B]/88 px-6 py-4 backdrop-blur-xl lg:hidden text-white">
      <div className="flex items-center gap-3">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#202857] shadow-[0_18px_44px_rgba(4,7,17,0.28)]">
          <Image src={LogoWordmark} alt="SecureDesk" className="h-12 w-auto object-contain" priority />
        </div>
      </div>
      
      {!isLoading && user && (
        <a href="/api/auth/logout" className="group">
          <Avatar src={user.picture} name={user.name || 'User'} className="cursor-pointer transition-all group-hover:ring-2 group-hover:ring-brand-500" />
        </a>
      )}
    </header>
  );
}
