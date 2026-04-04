'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuditPanel } from '@/components/audit/AuditPanel';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100dvh] overflow-hidden bg-surface-0 text-surface-900">
      <div className="brand-orb left-[-8rem] top-[10%] h-72 w-72 bg-brand-500/20" />
      <div className="brand-orb right-[12rem] top-[-4rem] h-64 w-64 bg-white/6" />
      <div className="brand-grid absolute inset-0 opacity-10" />
      <Sidebar />
      <div className="relative flex min-h-[100dvh] w-full flex-1 flex-col overflow-hidden lg:pl-72">
        <Header />
        <main className="flex min-h-0 flex-1 w-full overflow-hidden">
          <div className="relative min-h-0 h-full min-w-0 flex-1 overflow-y-auto border-t border-white/10 bg-[#10172d] shadow-2xl lg:rounded-tl-[2rem]">
            {children}
          </div>
          <AuditPanel />
        </main>
      </div>
    </div>
  );
}
