'use client';

import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { RiskClassification } from '@/types/risk';
import { ServiceIcon } from '../services/ServiceIcon';
import { AlertTriangle } from 'lucide-react';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  classification: RiskClassification;
  onApprove: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

export function ApprovalModal({
  isOpen,
  onClose,
  classification,
  onApprove,
  onReject,
  isProcessing = false
}: ApprovalModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Release High-Impact Action"
      footer={
        <>
          <Button variant="ghost" onClick={onReject} disabled={isProcessing}>
            Keep Blocked
          </Button>
          <Button
            variant="danger"
            onClick={onApprove}
            isLoading={isProcessing}
            className="shadow-red-500/20 shadow-lg"
          >
            Release Action
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-200 border border-amber-500/20">
          <div className="p-2 bg-amber-500/10 rounded-lg shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-surface-900 font-medium text-sm mb-1">Explicit approval required</h3>
            <p className="text-surface-600 text-sm leading-relaxed">
              This action would send or modify data outside SecureDesk, so it stays blocked until you
              release it.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-3 gap-4 items-center pl-2">
            <div className="text-surface-600 text-sm font-medium">Service</div>
            <div className="col-span-2 flex items-center gap-2">
              <ServiceIcon service={classification.service} className="w-5 h-5 text-surface-800" />
              <span className="text-surface-950 font-medium capitalize">{classification.service}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 items-center pl-2">
            <div className="text-surface-600 text-sm font-medium">Action</div>
            <div className="col-span-2">
              <span className="font-mono text-sm px-2 py-1 bg-surface-200 text-brand-400 rounded">
                {classification.action}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pl-2">
            <div className="text-surface-600 text-sm font-medium">Target Data</div>
            <div className="col-span-2 text-surface-900 text-sm font-medium">
              {classification.dataAffected}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pl-2 pt-2 border-t border-surface-300">
            <div className="text-surface-600 text-sm font-medium">Description</div>
            <div className="col-span-2 text-surface-800 text-sm">
              {classification.description}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
