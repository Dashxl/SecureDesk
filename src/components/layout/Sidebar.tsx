'use client';

import React from 'react';
import { MessageSquare, LayoutDashboard, ShieldAlert, Settings, LogOut } from 'lucide-react';
import { useUser } from '@auth0/nextjs-auth0/client';
import { Avatar } from '../ui/Avatar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const { user, isLoading } = useUser();
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Chat Agent', href: '/dashboard/chat', icon: MessageSquare },
    { name: 'Audit Log', href: '/dashboard/audit', icon: ShieldAlert },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 z-30 bg-surface-50/80 backdrop-blur-3xl border-r border-surface-200 p-4">
      <div className="flex items-center gap-3 px-2 py-4 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-xl text-white shadow-lg shadow-brand-500/20 shadow-glow">
          SD
        </div>
        <div className="flex flex-col">
          <span className="font-bold tracking-tight text-white leading-tight">SecureDesk</span>
          <span className="text-[10px] uppercase font-semibold text-brand-400 tracking-wider">Corporate AI</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 mt-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 group'
                  : 'text-surface-600 hover:text-surface-900 hover:bg-surface-200'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-400 drop-shadow-sm' : 'text-surface-600'}`} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-surface-200">
        {!isLoading && user ? (
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar src={user.picture} name={user.name || 'User'} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 truncate">
                {user.name}
              </p>
              <p className="text-xs text-surface-600 truncate">
                {user.email}
              </p>
            </div>
            <a href="/api/auth/logout" className="p-2 text-surface-600 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div className="h-12 loading-pulse bg-surface-200 rounded-lg"></div>
        )}
      </div>
    </aside>
  );
}
