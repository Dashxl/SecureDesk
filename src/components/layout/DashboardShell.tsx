'use client';

import React, { useMemo } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { AuditPanel } from '@/components/audit/AuditPanel';
import { useVisualViewport } from '@/hooks/use-visual-viewport';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { height: viewportHeight, isKeyboardOpen } = useVisualViewport();

  // On mobile, the keyboard can push the layout. We use the visual viewport height
  // to lock the main container to the actually visible area.
  const dynamicStyle = useMemo(() => {
    if (typeof window === 'undefined') return {};
    
    // Only apply dynamic height logic on small screens (mobile/tablet)
    const isMobile = window.innerWidth < 1024;
    if (!isMobile) return { height: '100dvh' };

    return {
      height: `${viewportHeight}px`,
      maxHeight: `${viewportHeight}px`,
      // Prevent browser's default "pushing up" behavior by setting fixed height
      position: isKeyboardOpen ? 'fixed' : 'relative',
      top: 0,
      left: 0,
    } as React.CSSProperties;
  }, [viewportHeight, isKeyboardOpen]);

  return (
    <div 
      className="relative flex w-full overflow-hidden bg-surface-0 text-surface-900 transition-[height] duration-75"
      style={dynamicStyle}
    >
      <div className="brand-orb left-[-8rem] top-[10%] h-72 w-72 bg-brand-500/20" />
      <div className="brand-orb right-[12rem] top-[-4rem] h-64 w-64 bg-white/6" />
      <div className="brand-grid absolute inset-0 opacity-10" />
      <Sidebar />
      <div className="relative flex h-full w-full flex-1 flex-col overflow-hidden lg:pl-72">
        <Header />
        <main className="flex min-h-0 flex-1 w-full overflow-hidden">
          <div className="relative min-h-0 h-full min-w-0 flex-1 flex flex-col overflow-hidden border-t border-white/10 bg-[#10172d] shadow-2xl lg:rounded-tl-[2rem]">
            {children}
          </div>
          <AuditPanel />
        </main>
      </div>
    </div>
  );
}
