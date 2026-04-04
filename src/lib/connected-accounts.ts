import { auth0, getCurrentUserAccessToken, getTokenForService } from './auth0';
import { getNormalizedIssuerBaseUrl } from './auth-env';
import { ServiceType } from '@/types/risk';

type ConnectedAccountService = Extract<ServiceType, 'slack' | 'gmail'>;

type ConnectedAccountRecord = {
  id: string;
  connection: string;
  access_type?: string;
  scopes?: string[];
  created_at?: string;
  updated_at?: string;
};

type ConnectedAccountStatus = {
  connected: boolean;
  accounts: ConnectedAccountRecord[];
  error: string | null;
};

type ConnectedAccountInitResult = {
  auth_session: string;
  connect_uri: string;
  connect_params?: Record<string, string>;
  expires_in?: number;
};

const CONNECTED_ACCOUNT_SCOPES = [
  'create:me:connected_accounts',
  'read:me:connected_accounts',
  'delete:me:connected_accounts',
].join(' ');

const SERVICE_CONFIG: Record<
  ConnectedAccountService,
  {
    connectionName: () => string;
    scopes: string[];
  }
> = {
  slack: {
    connectionName: () =>
      process.env.SLACK_CONNECTION_NAME || process.env.SLACK_CONNECTION_ID || 'slack',
    scopes: ['channels:read', 'groups:read', 'chat:write'],
  },
  gmail: {
    connectionName: () =>
      process.env.GMAIL_CONNECTION_NAME || process.env.GMAIL_CONNECTION_ID || 'google-oauth2',
    scopes: [
      'openid',
      'profile',
      'email',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
  },
};

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

export function getServiceConnectionName(service: ConnectedAccountService) {
  return SERVICE_CONFIG[service].connectionName();
}

export function getSlackConnectionName() {
  return getServiceConnectionName('slack');
}

export function getGmailConnectionName() {
  return getServiceConnectionName('gmail');
}

export async function getMyAccountApiAccessToken(options?: { refreshOnly?: boolean }) {
  if (!options?.refreshOnly) {
    try {
      const { accessToken } = await auth0.getAccessToken({
        authorizationParams: {
          audience: getMyAccountAudience(),
          scope: CONNECTED_ACCOUNT_SCOPES,
        },
      });

      if (typeof accessToken === 'string' && accessToken.split('.').length === 3) {
        return accessToken;
      }
    } catch (error) {
      console.warn('Could not read the current My Account API access token from the session.', error);
    }
  }

  try {
    const { accessToken } = await auth0.getAccessToken({
      authorizationParams: {
        audience: getMyAccountAudience(),
        scope: CONNECTED_ACCOUNT_SCOPES,
      },
      refresh: true,
    });

    if (!accessToken) {
      throw new Error(
        'Unable to obtain a My Account API access token. Confirm MRRT is enabled for Auth0 My Account API and sign in again.'
      );
    }

    return accessToken;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Unable to obtain a My Account API access token. Confirm MRRT is enabled for Auth0 My Account API and sign in again.'
    );
  }
}

async function callMyAccountApi<T>(
  endpoint: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<T> {
  const makeRequest = async (accessToken: string) =>
    fetch(`${getMyAccountApiBaseUrl()}${endpoint}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {}),
      },
    });

  const initialAccessToken = init.accessToken || (await getMyAccountApiAccessToken());
  let response = await makeRequest(initialAccessToken);

  if (response.status === 401 && !init.accessToken) {
    const refreshedAccessToken = await getMyAccountApiAccessToken({ refreshOnly: true });
    response = await makeRequest(refreshedAccessToken);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`My Account API request failed. ${errorText}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
}

export async function getConnectedAccounts(service: ConnectedAccountService) {
  const connection = getServiceConnectionName(service);
  const data = await callMyAccountApi<{ accounts?: ConnectedAccountRecord[] }>(
    `/connected-accounts/accounts?connection=${encodeURIComponent(connection)}`
  );

  return data.accounts ?? [];
}

export async function getConnectedAccountStatus(
  service: ConnectedAccountService
): Promise<ConnectedAccountStatus> {
  try {
    const accounts = await getConnectedAccounts(service);
    return {
      connected: accounts.length > 0,
      accounts,
      error: null,
    };
  } catch (error) {
    return {
      connected: false,
      accounts: [],
      error: error instanceof Error ? error.message : 'Unable to query connected accounts.',
    };
  }
}

export async function hasUsableConnectedAccountViaTokenVault(
  service: ConnectedAccountService
) {
  try {
    const accessToken = await getCurrentUserAccessToken();
    const providerToken = await getTokenForService(accessToken, getServiceConnectionName(service));

    return {
      connected: Boolean(providerToken),
      error: null,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unable to verify the connected account through Token Vault.',
    };
  }
}

export async function initiateConnectedAccount(
  service: ConnectedAccountService,
  redirectUri: string
) {
  const connection = getServiceConnectionName(service);
  const state = crypto.randomUUID();
  const result = await callMyAccountApi<ConnectedAccountInitResult>(
    '/connected-accounts/connect',
    {
      method: 'POST',
      body: JSON.stringify({
        connection,
        redirect_uri: redirectUri,
        state,
        scopes: SERVICE_CONFIG[service].scopes,
      }),
    }
  );

  return {
    ...result,
    state,
  };
}

export async function completeConnectedAccount(
  args: {
    authSession: string;
    connectCode: string;
    redirectUri: string;
  }
) {
  await callMyAccountApi('/connected-accounts/complete', {
    method: 'POST',
    body: JSON.stringify({
      auth_session: args.authSession,
      connect_code: args.connectCode,
      redirect_uri: args.redirectUri,
    }),
  });
}

export async function revokeConnectedAccount(
  service: ConnectedAccountService,
  accountId?: string
) {
  const id =
    accountId ||
    (await getConnectedAccounts(service)).find(
      (account) => account.connection === getServiceConnectionName(service)
    )?.id;

  if (!id) {
    return { revoked: false, message: `No ${service} connected account exists for this user.` };
  }

  await callMyAccountApi(`/connected-accounts/accounts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

  return { revoked: true, id };
}

export async function getSlackConnectedAccounts() {
  return getConnectedAccounts('slack');
}

export async function getSlackConnectedAccountStatus() {
  return getConnectedAccountStatus('slack');
}

export async function initiateSlackConnectedAccount(redirectUri: string) {
  return initiateConnectedAccount('slack', redirectUri);
}

export async function completeSlackConnectedAccount(args: {
  authSession: string;
  connectCode: string;
  redirectUri: string;
}) {
  return completeConnectedAccount(args);
}

export async function getGmailConnectedAccounts() {
  return getConnectedAccounts('gmail');
}

export async function getGmailConnectedAccountStatus() {
  return getConnectedAccountStatus('gmail');
}

export async function hasUsableSlackConnectedAccountViaTokenVault() {
  return hasUsableConnectedAccountViaTokenVault('slack');
}

export async function hasUsableGmailConnectedAccountViaTokenVault() {
  return hasUsableConnectedAccountViaTokenVault('gmail');
}

export async function initiateGmailConnectedAccount(redirectUri: string) {
  return initiateConnectedAccount('gmail', redirectUri);
}

export async function completeGmailConnectedAccount(args: {
  authSession: string;
  connectCode: string;
  redirectUri: string;
}) {
  return completeConnectedAccount(args);
}
