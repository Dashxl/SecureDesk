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
  };
};

export default function DashboardPage() {
  const { user } = useUser();
  const { messages: storeMessages, addMessage, updateMessage, setStreaming } = useChatStore();
  const { activeApprovalId, setActiveApproval, isApproving, setIsApproving } = useApprovalStore();
  const { upsertLogs } = useAuditStore();

  const activeApprovalMessage = storeMessages.find((message) => message.approvalId === activeApprovalId);

  async function runChatAction(content: string, approvalStatus?: 'approved' | 'rejected') {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        approvalStatus,
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
      const approvalId = uuidv4();

      addMessage({
        role: 'assistant',
        content: 'Action requires security approval to proceed.',
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
          error instanceof Error
            ? error.message
            : 'SecureDesk could not process the request.',
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
      await runChatAction(approvedActionContent, 'approved');
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

    void runChatAction(rejectedActionContent, 'rejected');
  };

  return (
    <div className="flex flex-col h-full w-full mx-auto relative">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#121a2d]/82 p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-[#202857]">
            <Image src={LogoMark} alt="SecureDesk mark" className="h-11 w-11 object-cover" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-white">Secure AI Assistant</h1>
            <p className="text-xs uppercase tracking-[0.24em] text-surface-700">Delegated actions with visible trust controls</p>
          </div>
        </div>
        <div className="text-xs text-brand-100 font-mono tracking-wide px-3 py-1.5 bg-brand-500/15 rounded-full border border-brand-400/20">
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
