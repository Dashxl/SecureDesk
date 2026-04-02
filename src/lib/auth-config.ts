import { auth0 } from './auth0';
import { getNormalizedIssuerBaseUrl } from './auth-env';

const REQUIRED_AUTH0_ENV_VARS = [
  'AUTH0_SECRET',
  'AUTH0_BASE_URL',
  'AUTH0_ISSUER_BASE_URL',
  'AUTH0_CLIENT_ID',
  'AUTH0_CLIENT_SECRET',
] as const;

const REQUIRED_FGA_ENV_VARS = [
  'FGA_API_URL',
  'FGA_STORE_ID',
  'FGA_MODEL_ID',
  'FGA_CLIENT_ID',
  'FGA_CLIENT_SECRET',
] as const;

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim() && !value.includes('YOUR_TENANT'));
}

export function isAuth0Configured() {
  return REQUIRED_AUTH0_ENV_VARS.every((envVar) => hasValue(process.env[envVar]));
}

export function hasIssuerPathMismatch() {
  return process.env.AUTH0_ISSUER_BASE_URL?.includes('/api/v2') ?? false;
}

export function isTokenVaultConfigured() {
  return (
    isAuth0Configured() &&
    hasValue(process.env.AUTH0_AUDIENCE) &&
    hasValue(process.env.AUTH0_TOKEN_VAULT_CLIENT_ID) &&
    hasValue(process.env.AUTH0_TOKEN_VAULT_CLIENT_SECRET) &&
    (
      hasValue(process.env.SLACK_CONNECTION_NAME) ||
      hasValue(process.env.SLACK_CONNECTION_ID) ||
      hasValue(process.env.GMAIL_CONNECTION_NAME) ||
      hasValue(process.env.GMAIL_CONNECTION_ID)
    )
  );
}

export function isFgaConfigured() {
  return REQUIRED_FGA_ENV_VARS.every((envVar) => hasValue(process.env[envVar]));
}

export function isCibaConfigured() {
  return (
    isAuth0Configured() &&
    hasValue(process.env.AUTH0_CIBA_CLIENT_ID) &&
    hasValue(process.env.AUTH0_CIBA_CLIENT_SECRET) &&
    hasValue(process.env.AUTH0_CIBA_AUDIENCE)
  );
}

export function getSetupStatus() {
  return {
    auth0Ready: isAuth0Configured(),
    tokenVaultReady: isTokenVaultConfigured(),
    fgaReady: isFgaConfigured(),
    cibaReady: isCibaConfigured(),
    issuerBaseUrl: getNormalizedIssuerBaseUrl(),
    issuerPathMismatch: hasIssuerPathMismatch(),
    slackConnectionName: process.env.SLACK_CONNECTION_NAME || '',
    slackConnectionId: process.env.SLACK_CONNECTION_ID || '',
    gmailConnectionName: process.env.GMAIL_CONNECTION_NAME || '',
    gmailConnectionId: process.env.GMAIL_CONNECTION_ID || '',
    audience: process.env.AUTH0_AUDIENCE || '',
  };
}

export async function safeGetSession() {
  if (!isAuth0Configured()) {
    return null;
  }

  try {
    return await auth0.getSession();
  } catch {
    return null;
  }
}
