import { NextResponse } from 'next/server';
import { getAuditLogs } from '@/lib/audit-logger';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: 'Auth0 is not configured.' }, { status: 503 });
  }

  const session = await safeGetSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const logs = await getAuditLogs(session.user.sub);
    return NextResponse.json(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
