import { RiskLevel, ActionStatus, ServiceType } from './risk';

export type { RiskLevel, ActionStatus, ServiceType } from './risk';

export interface AuditEntry {
  id: string;
  userId: string;
  action: string;
  service: ServiceType;
  riskLevel: RiskLevel;
  status: ActionStatus;
  details: string;
  approvedBy?: string | null;
  approvedAt?: string | null;
  executedAt?: string | null;
  metadata?: string | null;
  createdAt: string;
  updatedAt: string;
}
