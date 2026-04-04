import { NextResponse } from 'next/server';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';
import {
  getGmailConnectedAccountStatus,
  getSlackConnectedAccountStatus,
  hasUsableGmailConnectedAccountViaTokenVault,
  hasUsableSlackConnectedAccountViaTokenVault,
} from '@/lib/connected-accounts';
import { getConnectedServiceSnapshots } from '@/lib/connected-service-store';

function isSlackPrimaryIdentity(userId: string) {
  const slackConnectionName =
    process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack';

  return userId.includes(slackConnectionName) || /slack/i.test(userId);
}

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

  const userId = session.user.sub ?? session.user.email ?? '';

  const [slackStatus, gmailStatus, slackAccountStatus, gmailAccountStatus, serviceSnapshots] =
    await Promise.all([
    hasUsableSlackConnectedAccountViaTokenVault(),
    hasUsableGmailConnectedAccountViaTokenVault(),
    getSlackConnectedAccountStatus(),
    getGmailConnectedAccountStatus(),
    userId ? getConnectedServiceSnapshots(userId) : Promise.resolve([]),
  ]);

  const slackSnapshot = serviceSnapshots.find((snapshot) => snapshot.service === 'slack');
  const gmailSnapshot = serviceSnapshots.find((snapshot) => snapshot.service === 'gmail');
  const slackConnected = slackAccountStatus.connected;
  const gmailConnected = gmailAccountStatus.connected;
  const slackAvailable =
    slackStatus.connected ||
    slackAccountStatus.connected ||
    slackSnapshot?.status === 'connected' ||
    (isSlackPrimaryIdentity(userId) && slackStatus.connected);
  const gmailAvailable =
    gmailStatus.connected || gmailAccountStatus.connected || gmailSnapshot?.status === 'connected';

  const slackSource = slackAccountStatus.connected
    ? 'connected-account'
    : slackSnapshot?.status === 'connected'
      ? 'observed-usage'
      : isSlackPrimaryIdentity(userId) && slackStatus.connected
        ? 'slack-sign-in'
        : slackStatus.connected
          ? 'token-vault-runtime'
          : 'missing';
  const gmailSource = gmailAccountStatus.connected
    ? 'connected-account'
    : gmailSnapshot?.status === 'connected'
      ? 'observed-usage'
      : gmailStatus.connected
        ? 'token-vault-runtime'
        : 'missing';

  return NextResponse.json({
    slackConnected,
    gmailConnected,
    slackAvailable,
    gmailAvailable,
    allConnected: slackConnected && gmailConnected,
    allAvailable: slackAvailable && gmailAvailable,
    slackSource,
    gmailSource,
    slackError: slackStatus.error,
    gmailError: gmailStatus.error,
  });
}
