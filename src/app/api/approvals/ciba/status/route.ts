import { NextRequest, NextResponse } from 'next/server';
import { pollCIBAToken } from '@/lib/ciba';
import { isAuth0Configured, isCibaConfigured, safeGetSession } from '@/lib/auth-config';

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

  const authReqId = new URL(req.url).searchParams.get('authReqId');
  if (!authReqId) {
    return NextResponse.json({ error: 'authReqId is required.' }, { status: 400 });
  }

  try {
    const result = await pollCIBAToken(authReqId);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to poll the CIBA authorization request.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
