import { NextRequest, NextResponse } from 'next/server';
import { initiateGmailConnectedAccount } from '@/lib/connected-accounts';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';

const AUTH_SESSION_COOKIE = 'gmail_connect_auth_session';
const STATE_COOKIE = 'gmail_connect_state';

export async function GET(req: NextRequest) {
  if (!isAuth0Configured()) {
    return NextResponse.redirect(new URL('/dashboard/settings?gmail=auth0-not-configured', req.url));
  }

  const session = await safeGetSession();
  if (!session?.user) {
    return NextResponse.redirect(new URL('/api/auth/login', req.url));
  }

  const requestUrl = new URL(req.url);
  const resume = requestUrl.searchParams.get('resume') === '1';
  const baseUrl = process.env.AUTH0_BASE_URL || new URL(req.url).origin;
  const redirectUri = `${baseUrl}/dashboard/settings/gmail-callback`;

  if (!resume) {
    const returnTo = encodeURIComponent('/api/integrations/gmail/connect?resume=1');
    return NextResponse.redirect(
      new URL(`/api/auth/login?purpose=connect-gmail&returnTo=${returnTo}`, req.url)
    );
  }

  try {
    const result = await initiateGmailConnectedAccount(redirectUri);
    const connectUrl = new URL(result.connect_uri);

    Object.entries(result.connect_params ?? {}).forEach(([key, value]) => {
      connectUrl.searchParams.set(key, value);
    });

    const response = NextResponse.redirect(connectUrl);
    const maxAge = typeof result.expires_in === 'number' ? result.expires_in : 300;

    response.cookies.set(AUTH_SESSION_COOKIE, result.auth_session, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    });
    response.cookies.set(STATE_COOKIE, result.state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge,
    });

    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to start the Gmail connected account flow.';

    return NextResponse.redirect(
      new URL(`/dashboard/settings?gmail=connect-error&message=${encodeURIComponent(message)}`, req.url)
    );
  }
}
