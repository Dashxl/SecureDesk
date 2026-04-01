import { OpenFgaClient, CredentialsMethod } from '@openfga/sdk';

let fgaClient: OpenFgaClient | null = null;

const DEFAULT_FGA_API_TOKEN_ISSUER = 'https://fga.us.auth0.com/';
const DEFAULT_FGA_API_AUDIENCE = 'https://api.us1.fga.dev/';

export function isFGAConfigured() {
  return Boolean(
    process.env.FGA_API_URL &&
      process.env.FGA_STORE_ID &&
      process.env.FGA_MODEL_ID &&
      process.env.FGA_CLIENT_ID &&
      process.env.FGA_CLIENT_SECRET
  );
}

export function getFgaApiTokenIssuer() {
  return process.env.FGA_API_TOKEN_ISSUER || DEFAULT_FGA_API_TOKEN_ISSUER;
}

export function getFgaApiAudience() {
  return process.env.FGA_API_AUDIENCE || DEFAULT_FGA_API_AUDIENCE;
}

export function getToolObjectId(action: string) {
  return `tool:${action}`;
}

export function getFGAClient(): OpenFgaClient {
  if (fgaClient) return fgaClient;

  const apiUrl = process.env.FGA_API_URL;
  const storeId = process.env.FGA_STORE_ID;
  const clientId = process.env.FGA_CLIENT_ID;
  const clientSecret = process.env.FGA_CLIENT_SECRET;

  if (!apiUrl || !storeId || !clientId || !clientSecret) {
    throw new Error('FGA environment variables not configured');
  }

  fgaClient = new OpenFgaClient({
    apiUrl,
    storeId,
    authorizationModelId: process.env.FGA_MODEL_ID,
    credentials: {
      method: CredentialsMethod.ClientCredentials,
      config: {
        apiTokenIssuer: getFgaApiTokenIssuer(),
        apiAudience: getFgaApiAudience(),
        clientId,
        clientSecret,
      },
    },
  });

  return fgaClient;
}

export async function checkPermission(
  userId: string,
  relation: string,
  objectType: string,
  objectId: string
): Promise<boolean> {
  try {
    const client = getFGAClient();
    const result = await client.check({
      user: `user:${userId}`,
      relation,
      object: `${objectType}:${objectId}`,
    });
    return result.allowed ?? false;
  } catch (error) {
    console.warn('FGA check failed, defaulting to denied', error);
    return false;
  }
}

export function getRecommendedFgaModel() {
  return `model
  schema 1.1

type user

type tool
  relations
    define invoke: [user]`;
}

export function getRecommendedFgaTuples(userId: string) {
  return [
    `user:${userId} invoke tool:read_slack`,
    `user:${userId} invoke tool:post_slack_message`,
  ];
}
