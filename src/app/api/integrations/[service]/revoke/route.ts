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

  try {
    await revokeConnectedAccount(service);
    const userId = session.user.sub || session.user.email || 'unknown-user';
    await markServiceDisconnected(
      userId,
      service as SupportedService,
      service === 'slack'
        ? process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack'
        : process.env.GMAIL_CONNECTION_NAME || process.env.GMAIL_CONNECTION_ID || 'google-oauth2'
    );
    return NextResponse.redirect(
      new URL(`/dashboard/settings?${service}=revoked`, req.url)
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : `Unable to revoke the ${service} connected account.`;

    return NextResponse.redirect(
      new URL(`/dashboard/settings?${service}=revoke-error&message=${encodeURIComponent(message)}`, req.url)
    );
  }
}
