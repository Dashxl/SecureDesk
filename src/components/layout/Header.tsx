'use client';

import React from 'react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Avatar } from '../ui/Avatar';
import Image from 'next/image';
import LogoWordmark from '@/app/img/Logo4.jpg';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const { user, isLoading } = useUser();
  const pathname = usePathname();
  const navItems = [
    { name: 'Home', href: '/dashboard' },
    { name: 'Audit', href: '/dashboard/audit' },
    { name: 'Settings', href: '/dashboard/settings' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#11192B]/88 px-4 py-3 text-white backdrop-blur-xl lg:hidden">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="overflow-hidden rounded-2xl border border-white/10 bg-[#202857] shadow-[0_18px_44px_rgba(4,7,17,0.28)]">
          <Image src={LogoWordmark} alt="SecureDesk" className="h-10 w-auto object-contain sm:h-12" priority />
        </Link>
        
        {!isLoading && user && (
          <a href="/api/auth/logout" className="group shrink-0">
            <Avatar
              src={user.picture}
              name={user.name || 'User'}
              className="cursor-pointer transition-all group-hover:ring-2 group-hover:ring-brand-500"
            />
          </a>
        )}
      </div>

      <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold tracking-[0.14em] transition ${
                isActive
                  ? 'border-brand-400/30 bg-brand-500/15 text-white'
                  : 'border-white/10 bg-white/5 text-surface-700'
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
