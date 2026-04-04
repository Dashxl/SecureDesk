import { NextRequest, NextResponse } from 'next/server';
import { revokeConnectedAccount } from '@/lib/connected-accounts';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';
import { markServiceDisconnected } from '@/lib/connected-service-store';

type SupportedService = 'slack' | 'gmail';

function isSupportedService(value: string): value is SupportedService {
  return value === 'slack' || value === 'gmail';
}

export async function POST(
  req: NextRequest,
  context: { params: { service: string } }
) {
  if (!isAuth0Configured()) {
    return NextResponse.redirect(new URL('/dashboard/settings?integration=auth0-not-configured', req.url));
  }

  const session = await safeGetSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/api/auth/login', req.url));
  }

  const service = context.params.service;

  if (!isSupportedService(service)) {
    return NextResponse.redirect(
      new URL('/dashboard/settings?integration=unsupported-service', req.url)
    );
  }

  const userId = session.user.sub || session.user.email || 'unknown-user';
  let revokeWarning: string | null = null;

  try {
    const revokeResult = await revokeConnectedAccount(service);
    if (!revokeResult.revoked && revokeResult.message) {
      revokeWarning = revokeResult.message;
    }
  } catch (error) {
    revokeWarning =
      error instanceof Error
        ? error.message
        : `Unable to revoke the ${service} connected account from Auth0.`;
  }

  try {
    await markServiceDisconnected(
      userId,
      service as SupportedService,
      service === 'slack'
        ? process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack'
        : process.env.GMAIL_CONNECTION_NAME || process.env.GMAIL_CONNECTION_ID || 'google-oauth2'
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Unable to clear the ${service} connection state.`;

    return NextResponse.redirect(
      new URL(`/dashboard/settings?${service}=revoke-error&message=${encodeURIComponent(message)}`, req.url)
    );
  }

  const redirectUrl = new URL(`/dashboard/settings?${service}=revoked`, req.url);
  if (revokeWarning) {
    redirectUrl.searchParams.set('message', revokeWarning);
  }

  return NextResponse.redirect(redirectUrl);
}
