import { RiskClassification } from './risk';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: Date;
  risk?: RiskClassification;
  pendingApproval?: boolean;
  approvalId?: string;
}

export interface PendingAction {
  id: string;
  messageId: string;
  risk: RiskClassification;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}
