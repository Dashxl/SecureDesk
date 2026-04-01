import { prisma } from './prisma';
import { RiskLevel, ActionStatus, ServiceType, AuditEntry } from '@/types/audit';

function toAuditEntry(entry: {
  id: string;
  userId: string;
  action: string;
  service: string;
  riskLevel: string;
  status: string;
  details: string;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  executedAt?: Date | null;
  metadata?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AuditEntry {
  return {
    ...entry,
    riskLevel: entry.riskLevel as RiskLevel,
    status: entry.status as ActionStatus,
    service: entry.service as ServiceType,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    approvedAt: entry.approvedAt?.toISOString() ?? null,
    executedAt: entry.executedAt?.toISOString() ?? null,
  };
}

function isDatabaseConfigured() {
  return Boolean(process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_URL_NON_POOLING);
}

export async function logAction(entry: {
  userId: string;
  action: string;
  service: ServiceType;
  riskLevel: RiskLevel;
  status: ActionStatus;
  details: string;
  metadata?: string;
}): Promise<AuditEntry> {
  const now = new Date();

  if (!isDatabaseConfigured()) {
    return toAuditEntry({
      id: `ephemeral-${crypto.randomUUID()}`,
      userId: entry.userId,
      action: entry.action,
      service: entry.service,
      riskLevel: entry.riskLevel,
      status: entry.status,
      details: entry.details,
      metadata: entry.metadata ?? null,
      approvedBy: null,
      approvedAt: null,
      executedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  try {
    const result = await prisma.auditEntry.create({
      data: {
        userId: entry.userId,
        action: entry.action,
        service: entry.service,
        riskLevel: entry.riskLevel,
        status: entry.status,
        details: entry.details,
        metadata: entry.metadata,
      },
    });

    return toAuditEntry(result);
  } catch (error) {
    console.warn('Audit logging failed; continuing without persistent audit storage.', error);
    return toAuditEntry({
      id: `ephemeral-${crypto.randomUUID()}`,
      userId: entry.userId,
      action: entry.action,
      service: entry.service,
      riskLevel: entry.riskLevel,
      status: entry.status,
      details: entry.details,
      metadata: entry.metadata ?? null,
      approvedBy: null,
      approvedAt: null,
      executedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }
}

export async function getAuditLogs(userId: string): Promise<AuditEntry[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const logs = await prisma.auditEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return logs.map((log) => toAuditEntry(log));
  } catch (error) {
    console.warn('Audit log retrieval failed; returning an empty list.', error);
    return [];
  }
}
