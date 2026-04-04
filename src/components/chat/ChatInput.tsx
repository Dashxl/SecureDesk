import { useState, useRef, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !disabled) {
      onSend(input);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className="relative border-t border-white/10 bg-[#121a2d]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:p-4"
    >
      <div className="relative mx-auto flex max-w-4xl items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-2 shadow-sm transition-all focus-within:border-brand-400/40 focus-within:ring-2 focus-within:ring-brand-500/20 sm:gap-3 sm:p-2.5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask SecureDesk to read Slack, summarize today's email, or prepare a reviewed write action..."
          className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent p-2 text-[16px] leading-6 text-surface-950 outline-none placeholder:text-surface-700"
          disabled={disabled}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="mb-0.5 shrink-0 rounded-xl border border-brand-400/20 bg-brand-500/15 p-2.5 text-brand-100 transition-all hover:bg-brand-500/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizontal className="h-5 w-5" />
        </button>
      </div>
      <div
        className={`mx-auto hidden max-w-4xl px-1 text-center text-[10px] font-medium uppercase tracking-[0.22em] text-surface-700 transition-all sm:block ${
          isFocused ? 'mt-2 opacity-70' : 'mt-3 opacity-100'
        }`}
      >
        Gemini Flash intent layer | Auth0 Token Vault | Slack | Gmail | Auth0 FGA | Audit trail
      </div>
    </div>
  );
}
