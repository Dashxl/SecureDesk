export type RiskLevel = 'low' | 'high';

export type ActionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

export type ServiceType = 'gmail' | 'slack';

export interface RiskClassification {
  level: RiskLevel;
  action: string;
  service: ServiceType;
  description: string;
  dataAffected: string;
}
