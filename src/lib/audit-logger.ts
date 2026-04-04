import { prisma } from '@/lib/prisma';
import { RiskLevel, ActionStatus, ServiceType, AuditEntry } from '@/types/audit';

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
  const result = await prisma.auditEntry.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      service: entry.service,
      riskLevel: entry.riskLevel,
      status: entry.status,
      details: entry.details,
      metadata: entry.metadata,
      approvedBy: entry.approvedBy,
      approvedAt: entry.approvedAt,
      executedAt: entry.executedAt,
    },
  });

  return {
    ...result,
    service: result.service as ServiceType,
    riskLevel: result.riskLevel as RiskLevel,
    status: result.status as ActionStatus,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    approvedAt: result.approvedAt?.toISOString() || null,
    executedAt: result.executedAt?.toISOString() || null,
  };
}

export async function getAuditLogs(userId: string): Promise<AuditEntry[]> {
  const results = await prisma.auditEntry.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return results.map((result) => ({
    ...result,
    service: result.service as ServiceType,
    riskLevel: result.riskLevel as RiskLevel,
    status: result.status as ActionStatus,
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    approvedAt: result.approvedAt?.toISOString() || null,
    executedAt: result.executedAt?.toISOString() || null,
  }));
}
