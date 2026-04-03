import {
  createClient,
  createPool,
  type QueryResult,
  type QueryResultRow,
} from '@vercel/postgres';

type DbAttempt =
  | { kind: 'pool'; connectionString: string }
  | { kind: 'client'; connectionString: string };

function getConfiguredConnectionStrings() {
  return {
    pooled: process.env.POSTGRES_URL?.trim() || '',
    direct: process.env.POSTGRES_URL_NON_POOLING?.trim() || '',
  };
}

function isPooledConnectionString(connectionString: string) {
  return connectionString.includes('-pooler.');
}

function isLikelyDirectConnectionString(connectionString: string) {
  return connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
}

function serializeDbError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const details = Object.getOwnPropertyNames(error).reduce<Record<string, unknown>>(
      (accumulator, key) => {
        accumulator[key] = (error as Record<string, unknown>)[key];
        return accumulator;
      },
      {}
    );

    if (typeof details.message === 'string' && details.message.length > 0) {
      return details.message;
    }

    const constructorName =
      (error as { constructor?: { name?: string } }).constructor?.name || 'Object';

    if (Object.keys(details).length === 0) {
      return constructorName;
    }

    return JSON.stringify(details);
  }

  return 'Unknown database error.';
}

function shouldTryNextConnection(error: unknown) {
  const message = serializeDbError(error).toLowerCase();

  return (
    message.includes('invalid_connection_string') ||
    message.includes('pooled connection string') ||
    message.includes('direct connection')
  );
}

function normalizeDbError(error: unknown) {
  return new Error(serializeDbError(error));
}

function getDbAttempts(): DbAttempt[] {
  const { pooled, direct } = getConfiguredConnectionStrings();
  const attempts: DbAttempt[] = [];

  if (pooled) {
    attempts.push({
      kind: isLikelyDirectConnectionString(pooled) || !isPooledConnectionString(pooled) ? 'client' : 'pool',
      connectionString: pooled,
    });
  }

  if (direct && direct !== pooled) {
    attempts.push({ kind: 'client', connectionString: direct });
  }

  if (!pooled && direct) {
    attempts.push({ kind: 'client', connectionString: direct });
  }

  return attempts;
}

export function isPostgresConfigured() {
  const { pooled, direct } = getConfiguredConnectionStrings();
  return Boolean(pooled || direct);
}

export async function queryDb<T extends QueryResultRow = QueryResultRow>(
  query: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  const attempts = getDbAttempts();

  if (attempts.length === 0) {
    throw new Error(
      'Postgres is not configured. Add POSTGRES_URL or POSTGRES_URL_NON_POOLING before using the database.'
    );
  }

  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      if (attempt.kind === 'pool') {
        const pool = createPool({ connectionString: attempt.connectionString });
        return await pool.query<T>(query, params);
      }

      const client = createClient({ connectionString: attempt.connectionString });
      await client.connect();

      try {
        return await client.query<T>(query, params);
      } finally {
        await client.end();
      }
    } catch (error) {
      lastError = error;

      if (!shouldTryNextConnection(error)) {
        throw normalizeDbError(error);
      }
    }
  }

  throw normalizeDbError(lastError);
}

export async function runCoreMigrations() {
  if (!isPostgresConfigured()) {
    throw new Error(
      'Postgres is not configured. Link a Vercel Postgres database or add a local Postgres connection string.'
    );
  }

  await queryDb(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      service TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata JSONB,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await queryDb(`
    CREATE TABLE IF NOT EXISTS approval_sessions (
      id UUID PRIMARY KEY,
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      service TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `);
}
