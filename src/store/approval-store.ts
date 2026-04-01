import { create } from 'zustand';

interface ApprovalState {
  activeApprovalId: string | null;
  isApproving: boolean;
  error: string | null;
  setActiveApproval: (id: string | null) => void;
  setIsApproving: (isApproving: boolean) => void;
  setError: (error: string | null) => void;
}

export const useApprovalStore = create<ApprovalState>((set) => ({
  activeApprovalId: null,
  isApproving: false,
  error: null,

  setActiveApproval: (id) => set({ activeApprovalId: id, error: null }),
  setIsApproving: (isApproving) => set({ isApproving }),
  setError: (error) => set({ error })
}));
