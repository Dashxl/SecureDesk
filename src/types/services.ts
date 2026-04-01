import { ServiceType } from './risk';

export interface ServiceConnection {
  id: string;
  service: ServiceType;
  status: 'connected' | 'disconnected' | 'error';
  lastUsed?: string | null;
}

export interface ServiceAction {
  name: string;
  service: ServiceType;
  description: string;
  riskLevel: 'low' | 'high';
}
