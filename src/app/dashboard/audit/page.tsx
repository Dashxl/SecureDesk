'use client';

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuditStore } from '@/store/audit-store';

export default function AuditPage() {
  const { logs } = useAuditStore();
  
  return (
    <div className="flex flex-col h-full w-full p-6 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-brand-500" />
        <h1 className="text-2xl font-semibold text-surface-900">Immutable Audit Trail</h1>
      </div>
      <p className="text-surface-600 max-w-2xl">
        Every action taken by the AI is logged precisely with timestamps, risk level, status, and approval tracking. The panel on the right shows a live feed. Here you can search and export all events.
      </p>
      
      <div className="flex items-center justify-center flex-1 rounded-2xl border border-surface-300 bg-surface-200/50">
        <div className="text-center text-surface-600">
          <p className="font-medium text-lg mb-2">Total Events Logged: {logs.length}</p>
          <p className="text-sm">Extended filtering and export coming soon.</p>
        </div>
      </div>
    </div>
  );
}
