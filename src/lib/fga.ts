import { OpenFgaClient, CredentialsMethod } from '@openfga/sdk';

let fgaClient: OpenFgaClient | null = null;

export function isFGAConfigured() {
  return Boolean(
    process.env.FGA_API_URL &&
      process.env.FGA_STORE_ID &&
      process.env.FGA_MODEL_ID &&
      process.env.FGA_CLIENT_ID &&
      process.env.FGA_CLIENT_SECRET
  );
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
        apiTokenIssuer: 'fga.us.auth0.com',
        apiAudience: 'https://api.us1.fga.dev/',
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
