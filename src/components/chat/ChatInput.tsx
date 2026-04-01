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
    <div className="relative p-4 border-t border-surface-200 bg-surface-50/95 backdrop-blur">
      <div className="max-w-4xl mx-auto flex items-end gap-3 relative rounded-xl border border-surface-300 bg-surface-100 p-2 shadow-sm focus-within:ring-2 focus-within:ring-brand-500/50 focus-within:border-brand-500 transition-all">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Try: list my Slack channels or post a message to #engineering..."
          className="flex-1 max-h-32 min-h-[44px] bg-transparent resize-none outline-none text-surface-950 placeholder-surface-600 p-2 text-[15px]"
          disabled={disabled}
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || disabled}
          className="shrink-0 p-2.5 rounded-lg bg-surface-200 text-brand-400 hover:text-brand-300 hover:bg-surface-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all mb-0.5"
        >
          <SendHorizontal className="w-5 h-5" />
        </button>
      </div>
      <div className="max-w-4xl mx-auto mt-2 text-center text-[10px] text-surface-600 font-medium tracking-wide">
        ZERO-COST DEMO MODE: AUTH0 TOKEN VAULT + SLACK. FGA ENFORCED WHEN CONFIGURED. CIBA IS PHASE 2.
      </div>
    </div>
  );
}
