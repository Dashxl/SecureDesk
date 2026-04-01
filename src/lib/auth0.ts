import { initAuth0 } from '@auth0/nextjs-auth0';
import { getNormalizedIssuerBaseUrl } from './auth-env';

const issuerBaseURL = getNormalizedIssuerBaseUrl();

export const auth0 = initAuth0({
  secret: process.env.AUTH0_SECRET,
  baseURL: process.env.AUTH0_BASE_URL,
  issuerBaseURL: issuerBaseURL || process.env.AUTH0_ISSUER_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
  routes: {
    callback: '/api/auth/callback',
    login: '/api/auth/login',
    postLogoutRedirect: '/',
  },
  authorizationParams: {
    scope: 'openid profile email offline_access',
    audience: process.env.AUTH0_AUDIENCE,
  },
  session: {
    rollingDuration: 60 * 60 * 24,
    absoluteDuration: 60 * 60 * 24 * 7,
  },
});

async function getAccessTokenForAudience(audience: string, scope: string) {
  const { accessToken } = await auth0.getAccessToken({
    refresh: true,
    authorizationParams: {
      audience,
      scope,
    },
  });

  if (!accessToken) {
    throw new Error(`Unable to obtain an Auth0 access token for audience "${audience}".`);
  }

  return accessToken;
}

export async function getCurrentUserAccessToken(): Promise<string> {
  const audience = process.env.AUTH0_AUDIENCE;

  if (!audience) {
    throw new Error(
      'AUTH0_AUDIENCE is missing. SecureDesk needs a backend API audience to call Token Vault with access-token exchange.'
    );
  }

  return getAccessTokenForAudience(audience, 'openid profile email offline_access');
}

export async function getTokenForService(
  accessToken: string,
  connection: string
): Promise<string> {
  const issuer = issuerBaseURL || process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_TOKEN_VAULT_CLIENT_ID;
  const clientSecret = process.env.AUTH0_TOKEN_VAULT_CLIENT_SECRET;

  if (!issuer || !clientId || !clientSecret) {
    throw new Error(
      'Auth0 Token Vault access-token exchange is not fully configured. Add AUTH0_TOKEN_VAULT_CLIENT_ID and AUTH0_TOKEN_VAULT_CLIENT_SECRET from your Custom API Client in Auth0.'
    );
  }

  const response = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token',
      subject_token: accessToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
      requested_token_type: 'http://auth0.com/oauth/token-type/federated-connection-access-token',
      connection,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(
      `Token Vault exchange failed. Confirm Token Vault grant type is enabled and Slack is connected through Auth0. ${err}`
    );
  }

  const data = await response.json();

  if (!data.access_token) {
    throw new Error('Token Vault exchange succeeded but did not return an external provider access token.');
  }

  return data.access_token;
}
