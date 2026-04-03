'use client';

import React, { useEffect } from 'react';
import { useAuditStore } from '@/store/audit-store';
import { AuditEntry } from './AuditEntry';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import LogoMark from '@/app/img/Logo.jpg';

export function AuditPanel() {
  const { logs, isLoading, upsertLogs, setLoading, setError, filterRiskType, filterService } = useAuditStore();

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const res = await fetch('/api/audit');
        if (!res.ok) throw new Error('Failed to load logs');
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          upsertLogs(data);
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [setLoading, upsertLogs, setError]);

  const filteredLogs = logs.filter(log => {
    if (filterRiskType && log.riskLevel !== filterRiskType) return false;
    if (filterService && log.service !== filterService) return false;
    return true;
  });

  return (
    <div className="hidden h-full w-96 shrink-0 flex-col overflow-hidden bg-[#11192B] px-4 py-4 shadow-[-18px_0_40px_rgba(5,8,18,0.18)] lg:flex">
      <div className="mb-4 rounded-[1.35rem] border border-white/8 bg-[#1a2040] px-4 py-3 shadow-[0_16px_36px_rgba(4,7,17,0.18)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-white/10 bg-[#202857]">
            <Image src={LogoMark} alt="SecureDesk mark" className="h-9 w-9 object-cover" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold leading-none text-white">Trust Center</h2>
            <p className="text-[11px] uppercase tracking-[0.18em] text-brand-200/90">Live Trust Feed</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-[1.1rem] border border-white/8 bg-[#283052] px-3 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-surface-700">Events</div>
            <div className="mt-1 text-2xl font-bold text-white">{logs.length}</div>
          </div>
            <div className="rounded-[1.1rem] border border-brand-400/18 bg-[#261751] px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.2em] text-brand-200">Policy</div>
              <div className="mt-1 text-sm font-semibold text-white">Vault + FGA + Review</div>
            </div>
        </div>
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
            <p className="text-sm">No trust events recorded yet.</p>
          </div>
        ) : (
          filteredLogs.map(log => <AuditEntry key={log.id} entry={log} />)
        )}
      </div>
    </div>
  );
}
