import React from 'react';
import { AuditEntry as AuditEntryType } from '@/types/audit';
import { RiskBadge } from '../risk/RiskBadge';
import { ServiceIcon } from '../services/ServiceIcon';
import { formatDistanceToNow, format } from 'date-fns';
import { CheckCircle2, XCircle, Clock, CheckSquare } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

export function AuditEntry({ entry }: { entry: AuditEntryType }) {
  const timeAgo = formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true });
  const exactTime = format(new Date(entry.createdAt), 'PPpp');

  const StatusIcon = {
    pending: <Clock className="w-4 h-4 text-amber-500" />,
    approved: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    rejected: <XCircle className="w-4 h-4 text-red-500" />,
    executed: <CheckSquare className="w-4 h-4 text-brand-500" />,
    failed: <XCircle className="w-4 h-4 text-red-500" />
  }[entry.status];

  return (
    <div className="p-4 border border-surface-200 bg-surface-100 rounded-xl hover:bg-surface-200/50 transition-colors">
      <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="bg-surface-300 p-1.5 rounded-lg border border-surface-400">
            <ServiceIcon service={entry.service} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="font-semibold text-sm text-surface-950 capitalize leading-tight break-words">
              {entry.action.replace(/_/g, ' ')}
            </span>
            <Tooltip text={exactTime}>
              <span className="text-xs text-surface-600 font-medium cursor-default">
                {timeAgo}
              </span>
            </Tooltip>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <RiskBadge level={entry.riskLevel} />
          <Tooltip text={`Status: ${entry.status}`}>
            <div className="p-1 rounded bg-surface-200">
              {StatusIcon}
            </div>
          </Tooltip>
        </div>
      </div>
      
      <p className="text-sm text-surface-800 line-clamp-2 mt-2 leading-relaxed">
        {entry.details}
      </p>

      {entry.metadata && (
        <div className="mt-3 rounded-lg border border-surface-300 bg-surface-200/60 px-3 py-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-surface-600">
            Metadata
          </div>
          <div className="mt-1 text-sm text-surface-800 break-words">{entry.metadata}</div>
        </div>
      )}

      <div className="mt-3 space-y-2 border-t border-surface-300 pt-3 text-xs">
        {entry.approvedBy && (
          <div className="text-surface-600 flex flex-wrap items-center gap-1.5 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>
              Approved by <span className="text-surface-900">{entry.approvedBy}</span>
            </span>
            {entry.approvedAt && (
              <span className="text-surface-500 sm:ml-auto">
                {format(new Date(entry.approvedAt), 'HH:mm')}
              </span>
            )}
          </div>
        )}

        {entry.executedAt && (
          <div className="text-surface-600 flex items-center gap-1.5 font-medium">
            <CheckSquare className="w-3.5 h-3.5 text-brand-500" />
            <span>
              Executed at <span className="text-surface-900">{format(new Date(entry.executedAt), 'HH:mm:ss')}</span>
            </span>
          </div>
        )}

        <div className="text-surface-500 font-medium">
          User: <span className="text-surface-700">{entry.userId}</span>
        </div>
      </div>
    </div>
  );
}
