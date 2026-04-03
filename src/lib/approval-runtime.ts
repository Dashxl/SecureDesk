import { createHash, randomUUID } from 'crypto';
import { RiskClassification } from '@/types/risk';

export type ApprovalChannel = 'modal' | 'ciba';

export type PendingApprovalRequest = {
  id: string;
  userId: string;
  messageFingerprint: string;
  action: string;
  service: RiskClassification['service'];
  riskLevel: RiskClassification['level'];
  description: string;
  dataAffected: string;
  mode: ApprovalChannel;
  authReqId?: string;
  status: 'pending' | 'approved' | 'rejected';
  verifiedAt?: number;
  createdAt: number;
  expiresAt: number;
};

const APPROVAL_TTL_MS = 10 * 60 * 1000;

const globalForApprovals = globalThis as typeof globalThis & {
  secureDeskApprovalStore?: Map<string, PendingApprovalRequest>;
};

function getApprovalStore() {
  if (!globalForApprovals.secureDeskApprovalStore) {
    globalForApprovals.secureDeskApprovalStore = new Map<string, PendingApprovalRequest>();
  }

  const now = Date.now();
  for (const [id, request] of globalForApprovals.secureDeskApprovalStore.entries()) {
    if (request.expiresAt <= now) {
      globalForApprovals.secureDeskApprovalStore.delete(id);
    }
  }

  return globalForApprovals.secureDeskApprovalStore;
}

export function fingerprintApprovalMessage(message: string) {
  return createHash('sha256').update(message.trim()).digest('hex');
}

export function createApprovalRequest(args: {
  userId: string;
  message: string;
  classification: RiskClassification;
  mode: ApprovalChannel;
  authReqId?: string;
}) {
  const now = Date.now();
  const request: PendingApprovalRequest = {
    id: randomUUID(),
    userId: args.userId,
    messageFingerprint: fingerprintApprovalMessage(args.message),
    action: args.classification.action,
    service: args.classification.service,
    riskLevel: args.classification.level,
    description: args.classification.description,
    dataAffected: args.classification.dataAffected,
    mode: args.mode,
    authReqId: args.authReqId,
    status: 'pending',
    createdAt: now,
    expiresAt: now + APPROVAL_TTL_MS,
  };

  getApprovalStore().set(request.id, request);
  return request;
}

export function getApprovalRequestForUser(id: string, userId: string) {
  const request = getApprovalStore().get(id);

  if (!request) {
    return {
      request: null,
      error:
        'This approval session is no longer active. Please review the action again before SecureDesk proceeds.',
    };
  }

  if (request.userId !== userId) {
    return {
      request: null,
      error: 'This approval session belongs to a different user and cannot be reused here.',
    };
  }

  if (request.expiresAt <= Date.now()) {
    getApprovalStore().delete(id);
    return {
      request: null,
      error:
        'This approval session expired to protect the action boundary. Please submit the request again.',
    };
  }

  return { request, error: null };
}

export function approvalMatchesAction(
  request: PendingApprovalRequest,
  classification: RiskClassification,
  message: string
) {
  return (
    request.action === classification.action &&
    request.service === classification.service &&
    request.riskLevel === classification.level &&
    request.messageFingerprint === fingerprintApprovalMessage(message)
  );
}

export function consumeApprovalRequest(id: string) {
  getApprovalStore().delete(id);
}

export function updateApprovalRequestStatus(
  id: string,
  status: PendingApprovalRequest['status']
) {
  const store = getApprovalStore();
  const request = store.get(id);

  if (!request) {
    return null;
  }

  const nextRequest: PendingApprovalRequest = {
    ...request,
    status,
    verifiedAt: Date.now(),
  };

  store.set(id, nextRequest);
  return nextRequest;
}
