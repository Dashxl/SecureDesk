import { createHash } from 'crypto';
import { queryDb } from '@/lib/db';
import { RiskClassification } from '@/types/risk';
import { v4 as uuidv4 } from 'uuid';

export type ApprovalChannel = 'modal' | 'ciba';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'consumed' | 'expired';

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
  status: ApprovalStatus;
  verifiedAt?: number;
  createdAt: number;
  expiresAt: number;
};

type ApprovalPayload = {
  messageFingerprint: string;
  description: string;
  dataAffected: string;
  mode: ApprovalChannel;
  authReqId?: string | null;
  verifiedAt?: number | null;
  expiresAt: number;
};

type ApprovalSessionRow = {
  id: string;
  user_id: string;
  action_type: string;
  service: string;
  risk_level: string;
  status: ApprovalStatus;
  payload: ApprovalPayload | string | null;
  created_at: string | Date;
  resolved_at: string | Date | null;
};

const APPROVAL_TTL_MS = 10 * 60 * 1000;

function parseApprovalPayload(value: ApprovalSessionRow['payload']) {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as ApprovalPayload;
    } catch {
      return null;
    }
  }

  return value;
}

function mapApprovalRow(row: ApprovalSessionRow): PendingApprovalRequest {
  const payload = parseApprovalPayload(row.payload);

  if (!payload) {
    throw new Error('Approval session payload is missing.');
  }

  return {
    id: row.id,
    userId: row.user_id,
    messageFingerprint: payload.messageFingerprint,
    action: row.action_type,
    service: row.service as RiskClassification['service'],
    riskLevel: row.risk_level as RiskClassification['level'],
    description: payload.description,
    dataAffected: payload.dataAffected,
    mode: payload.mode,
    authReqId: payload.authReqId ?? undefined,
    status: row.status,
    verifiedAt: payload.verifiedAt ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    expiresAt: payload.expiresAt,
  };
}

async function getApprovalSessionRow(id: string) {
  const result = await queryDb<ApprovalSessionRow>(
    `
      SELECT id, user_id, action_type, service, risk_level, status, payload, created_at, resolved_at
      FROM approval_sessions
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export function fingerprintApprovalMessage(message: string) {
  return createHash('sha256').update(message.trim()).digest('hex');
}

export async function createApprovalRequest(args: {
  userId: string;
  message: string;
  classification: RiskClassification;
  mode: ApprovalChannel;
  authReqId?: string;
}) {
  const payload: ApprovalPayload = {
    messageFingerprint: fingerprintApprovalMessage(args.message),
    description: args.classification.description,
    dataAffected: args.classification.dataAffected,
    mode: args.mode,
    authReqId: args.authReqId ?? null,
    verifiedAt: null,
    expiresAt: Date.now() + APPROVAL_TTL_MS,
  };

  const result = await queryDb<ApprovalSessionRow>(
    `
      INSERT INTO approval_sessions (id, user_id, action_type, service, risk_level, status, payload)
      VALUES ($1, $2, $3, $4, $5, 'pending', $6::jsonb)
      RETURNING id, user_id, action_type, service, risk_level, status, payload, created_at, resolved_at
    `,
    [
      uuidv4(),
      args.userId,
      args.classification.action,
      args.classification.service,
      args.classification.level,
      JSON.stringify(payload),
    ]
  );

  return mapApprovalRow(result.rows[0]);
}

export async function getApprovalRequestForUser(id: string, userId: string) {
  const row = await getApprovalSessionRow(id);

  if (!row) {
    return {
      request: null,
      error:
        'This approval session is no longer active. Please review the action again before SecureDesk proceeds.',
    };
  }

  const request = mapApprovalRow(row);

  if (request.userId !== userId) {
    return {
      request: null,
      error: 'This approval session belongs to a different user and cannot be reused here.',
    };
  }

  if (request.status === 'consumed') {
    return {
      request: null,
      error:
        'This approval session is no longer active. Please review the action again before SecureDesk proceeds.',
    };
  }

  if (request.status === 'expired' || request.expiresAt <= Date.now()) {
    await updateApprovalRequestStatus(id, 'expired');
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

export async function consumeApprovalRequest(id: string) {
  await updateApprovalRequestStatus(id, 'consumed');
}

export async function updateApprovalRequestStatus(id: string, status: ApprovalStatus) {
  const row = await getApprovalSessionRow(id);

  const payload = row ? parseApprovalPayload(row.payload) : null;

  if (!row || !payload) {
    return null;
  }

  const nextPayload: ApprovalPayload = {
    ...payload,
    verifiedAt:
      status === 'approved' || status === 'rejected' || status === 'consumed' || status === 'expired'
        ? Date.now()
        : payload.verifiedAt ?? null,
  };

  const result = await queryDb<ApprovalSessionRow>(
    `
      UPDATE approval_sessions
      SET status = $2,
          payload = $3::jsonb,
          resolved_at = CASE
            WHEN $2 IN ('approved', 'rejected', 'consumed', 'expired') THEN NOW()
            ELSE resolved_at
          END
      WHERE id = $1
      RETURNING id, user_id, action_type, service, risk_level, status, payload, created_at, resolved_at
    `,
    [id, status, JSON.stringify(nextPayload)]
  );

  return result.rows[0] ? mapApprovalRow(result.rows[0]) : null;
}
