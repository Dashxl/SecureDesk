export function getNormalizedIssuerBaseUrl() {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL?.trim();

  if (!issuer) {
    return '';
  }

  return issuer.replace(/\/api\/v2\/?$/, '');
}

export function getNormalizedBaseUrl() {
  const configuredBaseUrl = process.env.AUTH0_BASE_URL?.trim();
  const vercelHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() || process.env.VERCEL_URL?.trim() || '';
  const vercelBaseUrl = vercelHost
    ? `https://${vercelHost.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
    : '';

  if (!configuredBaseUrl) {
    return vercelBaseUrl;
  }

  const normalizedConfiguredBaseUrl = configuredBaseUrl.replace(/\/$/, '');

  if (
    process.env.NODE_ENV === 'production' &&
    /localhost|127\.0\.0\.1/i.test(normalizedConfiguredBaseUrl) &&
    vercelBaseUrl
  ) {
    return vercelBaseUrl;
  }

  return normalizedConfiguredBaseUrl;
}
