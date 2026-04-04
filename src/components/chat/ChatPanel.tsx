import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { useChatStore } from '@/store/chat-store';
import { StreamingIndicator } from './StreamingIndicator';

export function ChatPanel({
  userPic,
  userName,
}: {
  userPic?: string | null;
  userName?: string;
}) {
  const { messages, isStreaming } = useChatStore();
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [shouldShowConnectionOnboarding, setShouldShowConnectionOnboarding] = useState(false);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (messages.length > 0) {
      return;
    }

    let isCancelled = false;

    async function loadIntegrationStatus() {
      try {
        const response = await fetch('/api/integrations/status', {
          cache: 'no-store',
        });

        if (!response.ok) {
          if (!isCancelled) {
            setShouldShowConnectionOnboarding(true);
          }
          return;
        }

        const data = (await response.json()) as { allConnected?: boolean };

        if (!isCancelled) {
          setShouldShowConnectionOnboarding(!data.allConnected);
        }
      } catch {
        if (!isCancelled) {
          setShouldShowConnectionOnboarding(true);
        }
      }
    }

    void loadIntegrationStatus();

    return () => {
      isCancelled = true;
    };
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4 text-center text-surface-500 sm:p-8">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-brand-500/10 sm:h-16 sm:w-16">
          <svg className="h-8 w-8 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <h3 className="mb-2 font-display text-xl font-bold text-white sm:text-2xl">
          Work through SecureDesk
        </h3>
        <p className="mx-auto max-w-xl text-sm leading-7 text-surface-700 sm:text-base">
          Ask in natural language. SecureDesk translates the request, checks policy, and only then
          reaches Slack or Gmail through Auth0 Token Vault. Start with a read action, then try a
          write action that moves into review before release.
        </p>
        {shouldShowConnectionOnboarding && (
          <div className="mt-6 w-full max-w-2xl rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-left sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              Before you begin
            </p>
            <p className="mt-2 text-sm leading-7 text-amber-50">
              Connect both Slack and Gmail in Settings first. SecureDesk only works inside apps that you
              explicitly authorize through Auth0 Connected Accounts.
            </p>
            <div className="mt-4">
              <Link href="/dashboard/settings" className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 sm:w-auto">
                Open Settings and connect apps
              </Link>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-3 sm:p-4 md:p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {messages.map((msg) => (
          <ChatMessageComponent key={msg.id} message={msg} userPic={userPic} userName={userName} />
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="inline-block rounded-2xl rounded-tl-sm bg-surface-200 px-5 py-3.5 shadow-sm">
              <StreamingIndicator />
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} className="h-4" />
      </div>
    </div>
  );
}
