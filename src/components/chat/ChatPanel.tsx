import React, { useEffect, useRef } from 'react';
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

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-surface-500">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-brand-500/10">
          <svg className="h-8 w-8 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        </div>
        <h3 className="mb-2 font-display text-2xl font-bold text-white">
          Operate through SecureDesk
        </h3>
        <p className="mx-auto max-w-xl text-sm leading-7 text-surface-700">
          Ask in natural language. Gemini Flash maps your request to SecureDesk&apos;s deterministic
          runtime, then Auth0 Token Vault, FGA, approvals, and audit logging take over. Try reading
          Slack channels, summarizing today&apos;s emails, or sending a high-risk message that requires
          approval.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-6">
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
