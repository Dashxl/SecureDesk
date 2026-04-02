import { isAuth0Configured } from '@/lib/auth-config';
import { auth0 } from '@/lib/auth0';
import { getMyAccountAudience } from '@/lib/connected-accounts';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest, context: { params: { auth0: string[] } }) {
  if (!isAuth0Configured()) {
    return new Response('Auth0 is not configured.', { status: 503 });
  }

  try {
    return auth0.handleAuth({
      login: (async (req: NextRequest, ctx: { params: { auth0: string[] } }) => {
        const loginUrl = new URL(req.url);
        const loginPurpose = loginUrl.searchParams.get('purpose');
        const returnTo = loginUrl.searchParams.get('returnTo') || undefined;

        if (loginPurpose === 'connect-slack' || loginPurpose === 'connect-gmail') {
          return auth0.handleLogin(req, ctx, {
            returnTo,
            authorizationParams: {
              audience: getMyAccountAudience(),
              scope:
                'openid profile email offline_access create:me:connected_accounts read:me:connected_accounts delete:me:connected_accounts',
            },
          });
        }

        return auth0.handleLogin(req, ctx, {
          returnTo,
        });
      }) as any,
    })(request, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Auth0 route error';
    return new Response(`Auth0 route error: ${message}`, { status: 500 });
  }
}
