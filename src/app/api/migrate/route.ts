import { NextResponse } from 'next/server';
import { runCoreMigrations } from '@/lib/db';

export async function GET() {
  try {
    await runCoreMigrations();
    return NextResponse.json({ ok: true, message: 'Core database tables are ready.' });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : 'Unable to run the database migration route.',
      },
      { status: 500 }
    );
  }
}
