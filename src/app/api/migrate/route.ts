import { NextResponse } from 'next/server';
import { runCoreMigrations } from '@/lib/db';

export async function GET() {
  try {
    await runCoreMigrations();
    return NextResponse.json({ ok: true, message: 'Core database tables are ready.' });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error, Object.getOwnPropertyNames(error ?? {}));

    console.error('Database migration failed:', error);

    return NextResponse.json(
      {
        ok: false,
        error: message || 'Unable to run the database migration route.',
      },
      { status: 500 }
    );
  }
}
