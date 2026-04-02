'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function getConnectCodeFromLocation(searchParams: URLSearchParams) {
  const queryConnectCode = searchParams.get('connect_code') || searchParams.get('code');

  if (queryConnectCode) {
    return queryConnectCode;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const hash = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : window.location.hash;
  const hashParams = new URLSearchParams(hash);

  return hashParams.get('connect_code') || hashParams.get('code');
}

export default function GmailCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const state = useMemo(() => searchParams.get('state'), [searchParams]);

  useEffect(() => {
    async function completeConnection() {
      const connectCode = getConnectCodeFromLocation(searchParams);

      if (!connectCode) {
        setError('Gmail did not return a connect code. Start the Connect Gmail flow again.');
        return;
      }

      try {
        const response = await fetch('/api/integrations/gmail/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connectCode,
            state,
          }),
        });

        const data = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(data.error || 'Gmail connection could not be completed.');
        }

        router.replace('/dashboard/settings?gmail=connected');
      } catch (completionError) {
        setError(
          completionError instanceof Error
            ? completionError.message
            : 'Gmail connection could not be completed.'
        );
      }
    }

    void completeConnection();
  }, [router, searchParams, state]);

  return (
    <div className="flex min-h-full items-center justify-center p-8">
      <div className="max-w-xl rounded-2xl border border-surface-300 bg-surface-100/60 p-6 text-center shadow-xl">
        <h1 className="text-xl font-semibold text-surface-900">Connecting Gmail</h1>
        {error ? (
          <>
            <p className="mt-3 text-sm text-red-300">{error}</p>
            <button
              onClick={() => router.replace('/dashboard/settings?gmail=error')}
              className="btn-primary mt-5 px-5 py-2.5 text-sm"
            >
              Back to Settings
            </button>
          </>
        ) : (
          <p className="mt-3 text-sm text-surface-600">
            SecureDesk is finalizing the Gmail Connected Account flow with Auth0 Token Vault.
          </p>
        )}
      </div>
    </div>
  );
}
