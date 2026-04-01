import React, { useEffect, useRef } from 'react';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { useChatStore } from '@/store/chat-store';
import { StreamingIndicator } from './StreamingIndicator';

export function ChatPanel({ userPic, userName }: { userPic?: string | null; userName?: string }) {
  const { messages, isStreaming } = useChatStore();
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-surface-500">
        <div className="w-16 h-16 rounded-full bg-surface-200 flex items-center justify-center mb-4 border border-surface-300">
          <svg className="w-8 h-8 text-surface-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-surface-900 mb-2">How can I help you today?</h3>
        <p className="text-sm max-w-sm mx-auto">
          Try a live Slack action like listing channels or drafting a message for `#engineering`. Gmail and Jira are still scaffolded, but Slack is the real Token Vault path in this demo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {messages.map((msg) => (
          <ChatMessageComponent key={msg.id} message={msg} userPic={userPic} userName={userName} />
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="bg-surface-200 px-5 py-3.5 rounded-2xl rounded-tl-sm shadow-sm inline-block">
              <StreamingIndicator />
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} className="h-4" />
      </div>
    </div>
  );
}
