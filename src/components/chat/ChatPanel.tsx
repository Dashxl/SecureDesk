'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { useChatStore } from '@/store/chat-store';
import { StreamingIndicator } from './StreamingIndicator';
import { useVisualViewport } from '@/hooks/use-visual-viewport';

export function ChatPanel({
  userPic,
  userName,
}: {
  userPic?: string | null;
  userName?: string;
}) {
  const { messages, isStreaming } = useChatStore();
  const { height: viewportHeight } = useVisualViewport();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [integrationStatus, setIntegrationStatus] = useState<{
    shouldShowOnboarding: boolean;
    slackConnected: boolean;
    gmailConnected: boolean;
    slackAvailable: boolean;
    gmailAvailable: boolean;
    slackSource?: string;
  }>({
    shouldShowOnboarding: false,
    slackConnected: false,
    gmailConnected: false,
    slackAvailable: false,
    gmailAvailable: false,
    slackSource: undefined,
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const container = scrollContainerRef.current;

      if (!container) {
        return;
      }

      if (messages.length === 0 && !isStreaming) {
        container.scrollTo({
          top: 0,
          behavior: 'auto',
        });
        return;
      }

      container.scrollTo({
        top: container.scrollHeight,
        behavior: messages.length > 0 ? 'smooth' : 'auto',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages.length, isStreaming, viewportHeight]);

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
            setIntegrationStatus({
              shouldShowOnboarding: true,
              slackConnected: false,
              gmailConnected: false,
              slackAvailable: false,
              gmailAvailable: false,
              slackSource: undefined,
            });
          }
          return;
        }

        const data = (await response.json()) as {
          allConnected?: boolean;
          allAvailable?: boolean;
          slackConnected?: boolean;
          gmailConnected?: boolean;
          slackAvailable?: boolean;
          gmailAvailable?: boolean;
          slackSource?: string;
        };

        if (!isCancelled) {
          setIntegrationStatus({
            shouldShowOnboarding: !data.allAvailable,
            slackConnected: Boolean(data.slackConnected),
            gmailConnected: Boolean(data.gmailConnected),
            slackAvailable: Boolean(data.slackAvailable),
            gmailAvailable: Boolean(data.gmailAvailable),
            slackSource: data.slackSource,
          });
        }
      } catch {
        if (!isCancelled) {
          setIntegrationStatus({
            shouldShowOnboarding: true,
            slackConnected: false,
            gmailConnected: false,
            slackAvailable: false,
            gmailAvailable: false,
            slackSource: undefined,
          });
        }
      }
    }

    void loadIntegrationStatus();

    return () => {
      isCancelled = true;
    };
  }, [messages.length]);

  const onboardingBody = (() => {
    if (integrationStatus.slackAvailable && integrationStatus.gmailAvailable) {
      return null;
    }

    if (integrationStatus.slackAvailable && !integrationStatus.gmailAvailable) {
      if (integrationStatus.slackSource === 'slack-sign-in') {
        return 'Slack is already ready through your sign-in session. If you want SecureDesk to work with Gmail too, connect Gmail in Settings.';
      }

      return 'Slack is already connected. If you want SecureDesk to work with Gmail too, connect Gmail in Settings.';
    }

    if (!integrationStatus.slackAvailable && integrationStatus.gmailAvailable) {
      return 'Gmail is already connected. Connect Slack in Settings if you want SecureDesk to work across both apps.';
    }

    return 'Connect Slack and Gmail in Settings first. SecureDesk only works inside apps that you explicitly authorize through Auth0 Connected Accounts.';
  })();

  const onboardingButtonLabel =
    integrationStatus.slackAvailable || integrationStatus.gmailAvailable
      ? 'Open Settings'
      : 'Open Settings and connect apps';

  return (
    <div 
      ref={scrollContainerRef} 
      className="flex h-full min-h-0 flex-1 overflow-y-auto p-3 overscroll-contain sm:p-4 md:p-6"
    >
      {messages.length === 0 ? (
        <div className="flex min-h-full w-full flex-col items-center justify-center text-center text-surface-500">
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
          {integrationStatus.shouldShowOnboarding && onboardingBody && (
            <div className="mt-6 w-full max-w-2xl rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-4 text-left sm:px-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Before you begin
              </p>
              <p className="mt-2 text-sm leading-7 text-amber-50">
                {onboardingBody}
              </p>
              <div className="mt-4">
                <Link href="/dashboard/settings" className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 sm:w-auto">
                  {onboardingButtonLabel}
                </Link>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mx-auto w-full max-w-4xl space-y-6">
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
          <div className="h-4" />
        </div>
      )}
    </div>
  );
}
