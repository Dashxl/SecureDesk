'use client';

import { useUser } from '@auth0/nextjs-auth0/client';
import { v4 as uuidv4 } from 'uuid';
import Image from 'next/image';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { ChatInput } from '@/components/chat/ChatInput';
import { ApprovalModal } from '@/components/risk/ApprovalModal';
import { useChatStore } from '@/store/chat-store';
import { useApprovalStore } from '@/store/approval-store';
import { RiskClassification } from '@/types/risk';
import { AuditEntry } from '@/types/audit';
import { useAuditStore } from '@/store/audit-store';
import LogoMark from '@/app/img/Logo.jpg';

type ChatResponse = {
  reply?: string;
  auditEntries?: AuditEntry[];
  approvalRequired?: {
    classification: RiskClassification;
    mode?: 'modal' | 'ciba';
    authReqId?: string;
    interval?: number;
  };
};

export default function DashboardPage() {
  const { user } = useUser();
  const { messages: storeMessages, addMessage, updateMessage, setStreaming } = useChatStore();
  const { activeApprovalId, setActiveApproval, isApproving, setIsApproving } = useApprovalStore();
  const { upsertLogs } = useAuditStore();

  const activeApprovalMessage = storeMessages.find(
    (message) => message.approvalId === activeApprovalId
  );

  async function pollCibaApproval(args: {
    authReqId: string;
    interval?: number;
    originalContent: string;
    waitingMessageId: string;
  }) {
    const pollDelay = Math.max((args.interval ?? 5) * 1000, 2500);

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, pollDelay));

      const response = await fetch(
        `/api/approvals/ciba/status?authReqId=${encodeURIComponent(args.authReqId)}`
      );
      const data = (await response.json()) as {
        status?: 'pending' | 'approved' | 'rejected';
        error?: string;
      };

      if (!response.ok) {
        updateMessage(args.waitingMessageId, {
          cibaPending: false,
          content: data.error || 'SecureDesk could not verify the CIBA approval state.',
        });
        return;
      }

      if (data.status === 'pending') {
        continue;
      }

      if (data.status === 'rejected') {
        updateMessage(args.waitingMessageId, {
          cibaPending: false,
          content: 'Approval rejected through Auth0 Guardian. No external action was executed.',
        });

        try {
          await runChatAction(args.originalContent, 'rejected', 'ciba');
        } catch (error) {
          addMessage({
            role: 'assistant',
            content:
              error instanceof Error
                ? error.message
                : 'SecureDesk could not record the rejected action.',
          });
        }
        return;
      }

      if (data.status === 'approved') {
        updateMessage(args.waitingMessageId, {
          cibaPending: false,
          content: 'Approval received through Auth0 Guardian. Executing now...',
        });

        setStreaming(true);
        try {
          await runChatAction(args.originalContent, 'approved', 'ciba');
        } catch (error) {
          addMessage({
            role: 'assistant',
            content:
              error instanceof Error
                ? error.message
                : 'SecureDesk could not complete the approved action.',
          });
        } finally {
          setStreaming(false);
        }
        return;
      }
    }
  }

  async function runChatAction(
    content: string,
    approvalStatus?: 'approved' | 'rejected',
    approvalMode?: 'modal' | 'ciba'
  ) {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        approvalStatus,
        approvalMode,
      }),
    });

    let data: ChatResponse | null = null;
    try {
      data = (await response.json()) as ChatResponse;
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(data?.reply || `SecureDesk request failed with status ${response.status}.`);
    }

    if (data?.auditEntries?.length) {
      upsertLogs(data.auditEntries);
    }

    if (data?.approvalRequired) {
      if (data.approvalRequired.mode === 'ciba' && data.approvalRequired.authReqId) {
        const waitingMessageId = addMessage({
          role: 'assistant',
          content:
            data.reply || 'Waiting for your approval - check your Auth0 Guardian notification.',
          risk: data.approvalRequired.classification,
          cibaPending: true,
          cibaRequestId: data.approvalRequired.authReqId,
          cibaInterval: data.approvalRequired.interval,
        });
        setStreaming(false);
        void pollCibaApproval({
          authReqId: data.approvalRequired.authReqId,
          interval: data.approvalRequired.interval,
          originalContent: content,
          waitingMessageId,
        });
        return;
      }

      const approvalId = uuidv4();

      addMessage({
        role: 'assistant',
        content: data.reply || 'Action requires security approval to proceed.',
        risk: data.approvalRequired.classification,
        pendingApproval: true,
        approvalId,
      });
      setStreaming(false);
      setActiveApproval(approvalId);
      return;
    }

    if (data?.reply) {
      addMessage({
        role: 'assistant',
        content: data.reply,
      });
    }
  }

  const isLoading = false;

  const handleSend = async (content: string) => {
    addMessage({ role: 'user', content });
    setStreaming(true);
    try {
      await runChatAction(content);
    } catch (error) {
      addMessage({
        role: 'assistant',
        content:
          error instanceof Error ? error.message : 'SecureDesk could not process the request.',
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleApprove = async () => {
    if (!activeApprovalMessage) {
      return;
    }

    const approvedActionContent = [...storeMessages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content;

    if (!approvedActionContent) {
      return;
    }

    setIsApproving(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    updateMessage(activeApprovalMessage.id, {
      pendingApproval: false,
      content: 'Action approved. Executing...',
    });
    setActiveApproval(null);
    setIsApproving(false);

    setStreaming(true);
    try {
      await runChatAction(approvedActionContent, 'approved', 'modal');
    } catch (error) {
      addMessage({
        role: 'assistant',
        content:
          error instanceof Error
            ? error.message
            : 'SecureDesk could not complete the approved action.',
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleReject = () => {
    const rejectedActionContent = [...storeMessages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content;

    if (activeApprovalMessage) {
      updateMessage(activeApprovalMessage.id, {
        pendingApproval: false,
        content: 'Action rejected.',
      });
    }

    setActiveApproval(null);

    if (!rejectedActionContent) {
      return;
    }

    void runChatAction(rejectedActionContent, 'rejected', 'modal');
  };

  return (
    <div className="relative mx-auto flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#121a2d]/82 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#202857]">
            <Image src={LogoMark} alt="SecureDesk mark" className="h-11 w-11 object-cover" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Secure AI Assistant</h1>
            <p className="text-xs uppercase tracking-[0.24em] text-surface-700">
              Delegated actions with visible trust controls
            </p>
          </div>
        </div>
        <div className="rounded-full border border-brand-400/20 bg-brand-500/15 px-3 py-1.5 font-mono text-xs tracking-wide text-brand-100">
          Deterministic Runtime Connected
        </div>
      </div>

      <ChatPanel userPic={user?.picture} userName={user?.name || undefined} />

      <div className="mt-auto">
        <ChatInput onSend={handleSend} disabled={isLoading || isApproving || !!activeApprovalId} />
      </div>

      {activeApprovalMessage?.risk && (
        <ApprovalModal
          isOpen={!!activeApprovalId}
          onClose={() => setActiveApproval(null)}
          classification={activeApprovalMessage.risk}
          isProcessing={isApproving}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </div>
  );
}
