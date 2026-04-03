import { NextRequest, NextResponse } from 'next/server';
import { pollCIBAToken } from '@/lib/ciba';
import { isAuth0Configured, isCibaConfigured, safeGetSession } from '@/lib/auth-config';
import { getApprovalRequestForUser, updateApprovalRequestStatus } from '@/lib/approval-runtime';

export async function GET(req: NextRequest) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: 'Auth0 is not configured.' }, { status: 503 });
  }

  if (!isCibaConfigured()) {
    return NextResponse.json({ error: 'CIBA is not configured.' }, { status: 503 });
  }

  const session = await safeGetSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const approvalId = new URL(req.url).searchParams.get('approvalId');
  if (!approvalId) {
    return NextResponse.json({ error: 'approvalId is required.' }, { status: 400 });
  }

  const userId = session.user.sub ?? session.user.email ?? 'unknown-user';
  const { request: approvalRequest, error } = getApprovalRequestForUser(approvalId, userId);

  if (!approvalRequest || error) {
    return NextResponse.json({ error }, { status: 400 });
  }

  if (approvalRequest.mode !== 'ciba' || !approvalRequest.authReqId) {
    return NextResponse.json(
      { error: 'This approval session is not linked to an external Auth0 Guardian request.' },
      { status: 400 }
    );
  }

  try {
    const result = await pollCIBAToken(approvalRequest.authReqId);

    if (result.status === 'approved') {
      updateApprovalRequestStatus(approvalId, 'approved');
    }

    if (result.status === 'rejected') {
      updateApprovalRequestStatus(approvalId, 'rejected');
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to poll the CIBA authorization request.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
