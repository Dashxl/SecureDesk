import { auth0 } from './auth0';
import { getNormalizedIssuerBaseUrl } from './auth-env';

const CONNECTED_ACCOUNT_SCOPES = [
  'create:me:connected_accounts',
  'read:me:connected_accounts',
].join(' ');

export function getMyAccountAudience() {
  const issuer = getNormalizedIssuerBaseUrl() || process.env.AUTH0_ISSUER_BASE_URL;

  if (!issuer) {
    throw new Error('Auth0 issuer base URL is not configured.');
  }

  return `${issuer.replace(/\/+$/, '')}/me/`;
}

export function getMyAccountApiBaseUrl() {
  const issuer = getNormalizedIssuerBaseUrl() || process.env.AUTH0_ISSUER_BASE_URL;

  if (!issuer) {
    throw new Error('Auth0 issuer base URL is not configured.');
  }

  return `${issuer.replace(/\/+$/, '')}/me/v1`;
}

export function getSlackConnectionName() {
  return process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack';
}

export async function getMyAccountApiAccessToken() {
  try {
    const { accessToken } = await auth0.getAccessToken({
      authorizationParams: {
        audience: getMyAccountAudience(),
        scope: CONNECTED_ACCOUNT_SCOPES,
      },
    });

    if (accessToken) {
      return accessToken;
    }
  } catch (error) {
    console.warn('Could not read the current My Account API access token from the session.', error);
  }

  const { accessToken } = await auth0.getAccessToken({
    refresh: true,
    authorizationParams: {
      audience: getMyAccountAudience(),
      scope: CONNECTED_ACCOUNT_SCOPES,
    },
  });

  if (!accessToken) {
    throw new Error(
      'Unable to obtain a My Account API access token. Confirm MRRT is enabled for Auth0 My Account API and sign in again.'
    );
  }

  return accessToken;
}

async function callMyAccountApi<T>(
  endpoint: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<T> {
  const accessToken = init.accessToken || (await getMyAccountApiAccessToken());
  const response = await fetch(`${getMyAccountApiBaseUrl()}${endpoint}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`My Account API request failed. ${errorText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function getSlackConnectedAccounts() {
  const connection = getSlackConnectionName();
  const data = await callMyAccountApi<{ accounts?: Array<{ id: string; connection: string; access_type?: string; scopes?: string[] }> }>(
    `/connected-accounts/accounts?connection=${encodeURIComponent(connection)}`
  );

  return data.accounts ?? [];
}

export async function getSlackConnectedAccountStatus() {
  try {
    const accounts = await getSlackConnectedAccounts();
    return {
      connected: accounts.length > 0,
      accounts,
      error: null as string | null,
    };
  } catch (error) {
    return {
      connected: false,
      accounts: [],
      error: error instanceof Error ? error.message : 'Unable to query connected accounts.',
    };
  }
}

export async function initiateSlackConnectedAccount(redirectUri: string) {
  const connection = getSlackConnectionName();
  const state = crypto.randomUUID();
  const data = await callMyAccountApi<{
    auth_session: string;
    connect_uri: string;
    connect_params?: Record<string, string>;
    expires_in?: number;
  }>('/connected-accounts/connect', {
    method: 'POST',
    body: JSON.stringify({
      connection,
      redirect_uri: redirectUri,
      state,
      scopes: ['channels:read', 'groups:read', 'chat:write'],
    }),
  });

  return {
    ...data,
    state,
  };
}

export async function completeSlackConnectedAccount(args: {
  authSession: string;
  connectCode: string;
  redirectUri: string;
}) {
  await callMyAccountApi('/connected-accounts/complete', {
    method: 'POST',
    body: JSON.stringify({
      auth_session: args.authSession,
      connect_code: args.connectCode,
      redirect_uri: args.redirectUri,
    }),
  });
}
