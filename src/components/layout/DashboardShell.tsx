'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuditPanel } from '@/components/audit/AuditPanel';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-screen overflow-hidden bg-surface-0 text-surface-900">
      <div className="brand-orb left-[-8rem] top-[10%] h-72 w-72 bg-brand-500/20" />
      <div className="brand-orb right-[12rem] top-[-4rem] h-64 w-64 bg-white/6" />
      <div className="brand-grid absolute inset-0 opacity-10" />
      <Sidebar />
      <div className="flex-1 flex flex-col lg:pl-72 h-full relative w-full overflow-hidden">
        <Header />
        <main className="flex-1 flex w-full h-full overflow-hidden">
          <div className="flex-1 min-w-0 h-full relative overflow-y-auto rounded-tl-[2rem] border-t border-white/10 bg-[#10172d] shadow-2xl">
            {children}
          </div>
          <AuditPanel />
        </main>
      </div>
    </div>
  );
}
