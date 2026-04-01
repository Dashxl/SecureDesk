export async function initiateCIBARequest(params: {
  userId: string;
  bindingMessage: string;
  scope?: string;
}): Promise<{ auth_req_id: string; expires_in: number; interval: number }> {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CIBA_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CIBA_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;

  const response = await fetch(`${issuer}/bc-authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      login_hint: JSON.stringify({ format: 'iss_sub', iss: issuer!, sub: params.userId }),
      scope: params.scope || 'openid',
      binding_message: params.bindingMessage,
      audience: process.env.AUTH0_CIBA_AUDIENCE || process.env.AUTH0_AUDIENCE || '',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`CIBA initiation failed: ${err}`);
  }

  return response.json();
}

export async function pollCIBAToken(authReqId: string): Promise<{
  status: 'pending' | 'approved' | 'rejected';
  access_token?: string;
}> {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL;
  const clientId = process.env.AUTH0_CIBA_CLIENT_ID || process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CIBA_CLIENT_SECRET || process.env.AUTH0_CLIENT_SECRET;

  const response = await fetch(`${issuer}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:openid:params:grant-type:ciba',
      auth_req_id: authReqId,
      client_id: clientId!,
      client_secret: clientSecret!,
    }),
  });

  if (response.status === 400) {
    const body = await response.json();
    if (body.error === 'authorization_pending') {
      return { status: 'pending' };
    }
    if (body.error === 'access_denied') {
      return { status: 'rejected' };
    }
    throw new Error(`CIBA poll error: ${body.error_description}`);
  }

  if (!response.ok) {
    throw new Error(`CIBA poll failed: ${response.statusText}`);
  }

  const data = await response.json();
  return { status: 'approved', access_token: data.access_token };
}
