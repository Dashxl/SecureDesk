'use client';

import React, { useEffect } from 'react';
import { useAuditStore } from '@/store/audit-store';
import { AuditEntry } from './AuditEntry';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Skeleton } from '../ui/Skeleton';

export function AuditPanel() {
  const { logs, isLoading, setLogs, setLoading, setError, filterRiskType, filterService } = useAuditStore();

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const res = await fetch('/api/audit');
        if (!res.ok) throw new Error('Failed to load logs');
        const data = await res.json();
        setLogs(data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [setLoading, setLogs, setError]);

  const filteredLogs = logs.filter(log => {
    if (filterRiskType && log.riskLevel !== filterRiskType) return false;
    if (filterService && log.service !== filterService) return false;
    return true;
  });

  return (
    <div className="w-80 border-l border-surface-300 bg-surface-50 p-4 flex flex-col h-full overflow-hidden shrink-0">
      <div className="flex items-center gap-2 px-2 py-3 mb-4 border-b border-surface-300">
        <div className="p-1.5 bg-brand-500/10 rounded-lg text-brand-400">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <h2 className="font-semibold text-lg text-white">Trust Center</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
        {isLoading ? (
          <>
            <div className="h-28 bg-surface-200 animate-pulse rounded-xl" />
            <div className="h-28 bg-surface-200 animate-pulse rounded-xl" />
            <div className="h-28 bg-surface-200 animate-pulse rounded-xl" />
          </>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center text-surface-600 mt-10">
            <ShieldCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No actions recorded yet.</p>
          </div>
        ) : (
          filteredLogs.map(log => <AuditEntry key={log.id} entry={log} />)
        )}
      </div>
    </div>
  );
}
