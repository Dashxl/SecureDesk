import { NextResponse } from 'next/server';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';
import {
  hasUsableGmailConnectedAccountViaTokenVault,
  hasUsableSlackConnectedAccountViaTokenVault,
} from '@/lib/connected-accounts';

export async function GET() {
  if (!isAuth0Configured()) {
    return NextResponse.json(
      {
        slackConnected: false,
        gmailConnected: false,
        allConnected: false,
        error: 'Auth0 is not configured.',
      },
      { status: 503 }
    );
  }

  const session = await safeGetSession();
  if (!session?.user) {
    return NextResponse.json(
      {
        slackConnected: false,
        gmailConnected: false,
        allConnected: false,
        error: 'Unauthorized',
      },
      { status: 401 }
    );
  }

  const [slackStatus, gmailStatus] = await Promise.all([
    hasUsableSlackConnectedAccountViaTokenVault(),
    hasUsableGmailConnectedAccountViaTokenVault(),
  ]);

  return NextResponse.json({
    slackConnected: slackStatus.connected,
    gmailConnected: gmailStatus.connected,
    allConnected: slackStatus.connected && gmailStatus.connected,
    slackError: slackStatus.error,
    gmailError: gmailStatus.error,
  });
}
