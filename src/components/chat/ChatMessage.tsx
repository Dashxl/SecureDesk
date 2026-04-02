import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { RiskBadge } from '../risk/RiskBadge';
import { Avatar } from '../ui/Avatar';
import { ShieldAlert, Bot, Loader2 } from 'lucide-react';
import { useApprovalStore } from '@/store/approval-store';
import { Button } from '../ui/Button';

export function ChatMessage({ message, userPic, userName }: { message: ChatMessageType; userPic?: string | null; userName?: string }) {
  const isUser = message.role === 'user';
  const { setActiveApproval } = useApprovalStore();

  return (
    <div className={`flex gap-4 w-full ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="shrink-0 pt-1">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white shadow-lg">
            <Bot className="w-4 h-4" />
          </div>
        </div>
      )}

      <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <span className="text-xs font-semibold text-surface-600">
            {isUser ? (userName || 'You') : 'SecureDesk Agent'}
          </span>
          {!isUser && message.risk && (
            <RiskBadge level={message.risk.level} />
          )}
        </div>

        <div className={`
          relative px-5 py-3.5 text-[15px] leading-relaxed
          ${isUser 
            ? 'bg-brand-600 text-white rounded-2xl rounded-tr-sm shadow-md' 
            : 'bg-surface-200 text-surface-950 border border-surface-300 rounded-2xl rounded-tl-sm shadow-sm'
          }
        `}>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          
          {message.pendingApproval && message.approvalId && (
             <div className="mt-4 p-4 bg-surface-300/50 rounded-lg border border-surface-400">
               <div className="flex items-center gap-2 mb-2">
                 <ShieldAlert className="w-4 h-4 text-amber-500" />
                 <span className="text-sm font-semibold text-amber-500">Action Pending Approval</span>
               </div>
               <p className="text-xs text-surface-600 mb-3">Please review and authorize this action to proceed.</p>
               <Button size="sm" onClick={() => setActiveApproval(message.approvalId!)}>
                 Review & Approve
               </Button>
             </div>
          )}

          {message.cibaPending && (
            <div className="mt-4 rounded-lg border border-brand-400/20 bg-brand-500/10 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-brand-300" />
                <span className="text-sm font-semibold text-brand-200">
                  Waiting for your approval
                </span>
              </div>
              <p className="text-xs text-surface-700">
                Check your Auth0 Guardian notification or external approval channel. SecureDesk will
                continue automatically after approval.
              </p>
            </div>
          )}
        </div>
      </div>

      {isUser && (
        <div className="shrink-0 pt-1">
          <Avatar src={userPic} name={userName || 'User'} className="shadow-lg" />
        </div>
      )}
    </div>
  );
}
