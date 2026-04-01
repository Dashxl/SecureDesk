export function getNormalizedIssuerBaseUrl() {
  const issuer = process.env.AUTH0_ISSUER_BASE_URL?.trim();

  if (!issuer) {
    return '';
  }

  return issuer.replace(/\/api\/v2\/?$/, '');
}
