import { sql } from '@vercel/postgres';

export { sql };

export function isPostgresConfigured() {
  return Boolean(process.env.POSTGRES_URL);
}

export async function runCoreMigrations() {
  if (!isPostgresConfigured()) {
    throw new Error(
      'POSTGRES_URL is not configured. Link a Vercel Postgres database or add a local Postgres connection string.'
    );
  }

  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      service TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata JSONB,
      timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS approval_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      service TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payload JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      resolved_at TIMESTAMPTZ
    )
  `;
}
