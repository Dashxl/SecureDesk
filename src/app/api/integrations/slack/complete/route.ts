import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { completeSlackConnectedAccount } from '@/lib/connected-accounts';
import { isAuth0Configured, safeGetSession } from '@/lib/auth-config';

const AUTH_SESSION_COOKIE = 'slack_connect_auth_session';
const STATE_COOKIE = 'slack_connect_state';

export async function POST(req: Request) {
  if (!isAuth0Configured()) {
    return NextResponse.json({ error: 'Auth0 is not configured.' }, { status: 503 });
  }

  const session = await safeGetSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connectCode, state } = (await req.json()) as {
    connectCode?: string;
    state?: string;
  };

  const cookieStore = cookies();
  const authSession = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;

  if (!connectCode) {
    return NextResponse.json({ error: 'Missing connect code.' }, { status: 400 });
  }

  if (!authSession || !expectedState) {
    return NextResponse.json(
      { error: 'Slack connection session expired. Start the Connect Slack flow again.' },
      { status: 400 }
    );
  }

  if (state && state !== expectedState) {
    return NextResponse.json({ error: 'Slack connection state mismatch.' }, { status: 400 });
  }

  const baseUrl = process.env.AUTH0_BASE_URL || new URL(req.url).origin;
  const redirectUri = `${baseUrl}/dashboard/settings/slack-callback`;

  try {
    await completeSlackConnectedAccount({
      authSession,
      connectCode,
      redirectUri,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    response.cookies.set(STATE_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to complete the Slack connected account flow.',
      },
      { status: 500 }
    );
  }
}
