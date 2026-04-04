'use client';

import React, { useEffect, useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuditStore } from '@/store/audit-store';
import { AuditEntry } from '@/components/audit/AuditEntry';

export default function AuditPage() {
  const {
    logs,
    isLoading,
    error,
    setLogs,
    setLoading,
    setError,
    filterRiskType,
    filterService,
    filterStatus,
    setFilterRiskType,
    setFilterService,
    setFilterStatus,
  } = useAuditStore();

  useEffect(() => {
    let isCancelled = false;

    async function fetchLogs(showLoader: boolean) {
      if (showLoader) {
        setLoading(true);
      }

      try {
        const res = await fetch('/api/audit', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load logs');
        const data = await res.json();

        if (!isCancelled) {
          setLogs(Array.isArray(data) ? data : []);
          setError(null);
        }
      } catch (fetchError) {
        if (!isCancelled) {
          setError(fetchError instanceof Error ? fetchError.message : 'Failed to load logs');
        }
      } finally {
        if (!isCancelled && showLoader) {
          setLoading(false);
        }
      }
    }

    void fetchLogs(true);
    const interval = window.setInterval(() => {
      void fetchLogs(false);
    }, 5000);

    return () => {
      isCancelled = true;
      window.clearInterval(interval);
    };
  }, [setError, setLoading, setLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterRiskType && log.riskLevel !== filterRiskType) {
        return false;
      }

      if (filterService && log.service !== filterService) {
        return false;
      }

      if (filterStatus && log.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [filterRiskType, filterService, filterStatus, logs]);

  const counts = useMemo(() => {
    return {
      total: logs.length,
      highRisk: logs.filter((log) => log.riskLevel === 'high').length,
      executed: logs.filter((log) => log.status === 'executed').length,
      failed: logs.filter((log) => log.status === 'failed').length,
    };
  }, [logs]);

  const exportCsv = () => {
    if (filteredLogs.length === 0) {
      return;
    }

    const csvRows = [
      [
        'id',
        'createdAt',
        'service',
        'action',
        'riskLevel',
        'status',
        'userId',
        'approvedBy',
        'approvedAt',
        'executedAt',
        'details',
        'metadata',
      ],
      ...filteredLogs.map((log) => [
        log.id,
        log.createdAt,
        log.service,
        log.action,
        log.riskLevel,
        log.status,
        log.userId,
        log.approvedBy ?? '',
        log.approvedAt ?? '',
        log.executedAt ?? '',
        log.details,
        log.metadata ?? '',
      ]),
    ];

    const csv = csvRows
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    link.href = url;
    link.download = `securedesk-audit-${timestamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  return (
    <div className="flex h-full min-h-0 w-full flex-col space-y-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="w-6 h-6 text-brand-500" />
        <h1 className="text-xl font-semibold text-surface-900 sm:text-2xl">Immutable Audit Trail</h1>
      </div>
      <p className="text-surface-600 max-w-2xl">
        Every action taken by SecureDesk is logged with timestamps, risk level, status, and approval
        tracking. The panel on the right streams the live trust feed, and this view lets you search
        or export the history.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-surface-300 bg-surface-100/60 p-4">
          <p className="text-xs uppercase tracking-wide text-surface-600">Total</p>
          <p className="mt-2 text-2xl font-semibold text-surface-900">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-surface-300 bg-surface-100/60 p-4">
          <p className="text-xs uppercase tracking-wide text-surface-600">High Risk</p>
          <p className="mt-2 text-2xl font-semibold text-surface-900">{counts.highRisk}</p>
        </div>
        <div className="rounded-2xl border border-surface-300 bg-surface-100/60 p-4">
          <p className="text-xs uppercase tracking-wide text-surface-600">Executed</p>
          <p className="mt-2 text-2xl font-semibold text-surface-900">{counts.executed}</p>
        </div>
        <div className="rounded-2xl border border-surface-300 bg-surface-100/60 p-4">
          <p className="text-xs uppercase tracking-wide text-surface-600">Failed</p>
          <p className="mt-2 text-2xl font-semibold text-surface-900">{counts.failed}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <select
          value={filterService ?? ''}
          onChange={(event) => setFilterService(event.target.value || null)}
          className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2 text-sm text-surface-900 sm:min-w-[10rem]"
        >
          <option value="">All services</option>
          <option value="slack">Slack</option>
          <option value="gmail">Gmail</option>
        </select>
        <select
          value={filterRiskType ?? ''}
          onChange={(event) => setFilterRiskType(event.target.value || null)}
          className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2 text-sm text-surface-900 sm:min-w-[10rem]"
        >
          <option value="">All risk levels</option>
          <option value="low">Low risk</option>
          <option value="high">High risk</option>
        </select>
        <select
          value={filterStatus ?? ''}
          onChange={(event) => setFilterStatus(event.target.value || null)}
          className="rounded-xl border border-surface-300 bg-surface-100 px-3 py-2 text-sm text-surface-900 sm:min-w-[10rem]"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="executed">Executed</option>
          <option value="failed">Failed</option>
        </select>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filteredLogs.length === 0}
          className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-2 text-sm font-medium text-surface-900 transition-colors hover:bg-surface-200 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          Export CSV
        </button>
      </div>

      <div className="flex-1 rounded-2xl border border-surface-300 bg-surface-100/50 p-4">
        {isLoading ? (
          <div className="text-center text-surface-600 py-12 text-sm">Loading audit entries...</div>
        ) : error ? (
          <div className="text-center text-red-300 py-12 text-sm">{error}</div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-surface-600 py-12">
              <p className="font-medium text-lg mb-2">No matching audit events yet.</p>
              <p className="text-sm">Run a connected action to populate the trust history.</p>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <AuditEntry key={log.id} entry={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
