'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuditPanel } from '@/components/audit/AuditPanel';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 text-surface-900">
      <Sidebar />
      <div className="flex-1 flex flex-col lg:pl-64 h-full relative w-full overflow-hidden">
        <Header />
        <main className="flex-1 flex w-full h-full overflow-hidden">
          <div className="flex-1 min-w-0 h-full relative overflow-y-auto bg-surface-0 shadow-2xl rounded-tl-3xl border-t border-l border-surface-200">
            {children}
          </div>
          <AuditPanel />
        </main>
      </div>
    </div>
  );
}
