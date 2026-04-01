'use client';

import React from 'react';
import { LayoutDashboard, ShieldAlert, Settings, LogOut } from 'lucide-react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Avatar } from '../ui/Avatar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import LogoWordmark from '@/app/img/Logo4.jpg';

export function Sidebar() {
  const { user, isLoading } = useUser();
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Audit Log', href: '/dashboard/audit', icon: ShieldAlert },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex w-72 flex-col fixed inset-y-0 left-0 z-30 border-r border-white/10 bg-[#11192B] p-5">
      <div className="mb-4 px-1">
        <div className="rounded-[1rem] bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-[3px] rounded-full bg-gradient-to-b from-brand-300 to-brand-500" />
            <div className="w-[152px]">
              <Image
                src={LogoWordmark}
                alt="SecureDesk"
                className="h-auto w-full object-cover opacity-90"
                priority
              />
            </div>
          </div>

          <div className="ml-6 mt-2 w-[152px] text-center text-[8px] uppercase tracking-[0.28em] text-brand-100/60">
            Corporate AI Control
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 mt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-brand-500/30 to-brand-500/10 text-white shadow-lg shadow-brand-500/10'
                  : 'text-surface-700 hover:bg-white/5 hover:text-surface-950'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-200 drop-shadow-sm' : 'text-surface-700'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-white/10">
        {!isLoading && user ? (
          <div className="flex items-center gap-3 rounded-[1.1rem] border border-white/8 bg-[#151d33] px-3 py-3">
            <Avatar src={user.picture} name={user.name || 'User'} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-surface-700 truncate">
                {user.email}
              </p>
            </div>
            <a href="/api/auth/logout" className="rounded-xl p-2 text-surface-700 transition-colors hover:bg-white/5 hover:text-red-300">
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="h-12 rounded-lg bg-surface-200 loading-pulse"></div>
        )}
      </div>
    </aside>
  );
}
