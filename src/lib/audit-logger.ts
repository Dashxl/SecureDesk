import { queryDb } from '@/lib/db';
import { RiskLevel, ActionStatus, ServiceType, AuditEntry } from '@/types/audit';
import { v4 as uuidv4 } from 'uuid';

type StoredAuditMetadata = {
  details: string;
  metadataText?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
};

type AuditLogRow = {
  id: string;
  user_id: string;
  action_type: string;
  service: string;
  risk_level: string;
  status: string;
  metadata: StoredAuditMetadata | string | null;
  timestamp: string | Date;
};

function parseStoredAuditMetadata(value: AuditLogRow['metadata']) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as StoredAuditMetadata;
    } catch {
      return null;
    }
  }

  return value;
}

function toAuditEntry(row: AuditLogRow): AuditEntry {
  const metadata = parseStoredAuditMetadata(row.metadata);
  const createdAt = new Date(row.timestamp).toISOString();

  return {
    id: row.id,
    userId: row.user_id,
    action: row.action_type,
    service: row.service as ServiceType,
    riskLevel: row.risk_level as RiskLevel,
    status: row.status as ActionStatus,
    details: metadata?.details || row.action_type,
    approvedBy: metadata?.approvedBy ?? null,
    approvedAt: metadata?.approvedAt ?? null,
    executedAt: metadata?.executedAt ?? null,
    metadata: metadata?.metadataText ?? null,
    createdAt,
    updatedAt: createdAt,
  };
}

export async function logAction(entry: {
  userId: string;
  action: string;
  service: ServiceType;
  riskLevel: RiskLevel;
  status: ActionStatus;
  details: string;
  metadata?: string;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  executedAt?: Date | null;
}): Promise<AuditEntry> {
  const storedMetadata: StoredAuditMetadata = {
    details: entry.details,
    metadataText: entry.metadata ?? null,
    approvedBy: entry.approvedBy ?? null,
    approvedAt: entry.approvedAt?.toISOString() ?? null,
    executedAt: entry.executedAt?.toISOString() ?? null,
  };

  const result = await queryDb<AuditLogRow>(
    `
      INSERT INTO audit_logs (id, user_id, action_type, service, risk_level, status, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, user_id, action_type, service, risk_level, status, metadata, timestamp
    `,
    [
      uuidv4(),
      entry.userId,
      entry.action,
      entry.service,
      entry.riskLevel,
      entry.status,
      JSON.stringify(storedMetadata),
    ]
  );

  return toAuditEntry(result.rows[0]);
}

export async function getAuditLogs(userId: string): Promise<AuditEntry[]> {
  const result = await queryDb<AuditLogRow>(
    `
      SELECT id, user_id, action_type, service, risk_level, status, metadata, timestamp
      FROM audit_logs
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT 100
    `,
    [userId]
  );

  return result.rows.map((row) => toAuditEntry(row));
}
