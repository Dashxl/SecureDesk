import { useState, useRef, useEffect } from 'react';
import { SendHorizontal } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState('');
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
    <div className="relative border-t border-white/10 bg-[#121a2d]/90 p-4 backdrop-blur">
      <div className="relative mx-auto flex max-w-4xl items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5 shadow-sm transition-all focus-within:border-brand-400/40 focus-within:ring-2 focus-within:ring-brand-500/20">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Try: summarize my emails from today or post a message to #general-securedesk..."
          className="max-h-32 min-h-[44px] flex-1 resize-none bg-transparent p-2 text-[15px] text-surface-950 outline-none placeholder:text-surface-700"
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
      <div className="mx-auto mt-3 max-w-4xl text-center text-[10px] font-medium uppercase tracking-[0.22em] text-surface-700">
        Gemini Flash intent layer • Auth0 Token Vault • Slack • Gmail • FGA • Audit trail
      </div>
    </div>
  );
}
