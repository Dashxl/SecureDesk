import { create } from 'zustand';
import { ChatMessage, PendingAction } from '@/types/chat';
import { v4 as uuidv4 } from 'uuid';

interface ChatState {
  messages: ChatMessage[];
  pendingActions: PendingAction[];
  isStreaming: boolean;
  addMessage: (message: Omit<ChatMessage, 'id' | 'createdAt'>) => string;
  updateMessage: (id: string, partial: Partial<ChatMessage>) => void;
  addPendingAction: (action: Omit<PendingAction, 'id' | 'createdAt'>) => string;
  resolvePendingAction: (id: string, status: 'approved' | 'rejected') => void;
  setStreaming: (isStreaming: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  pendingActions: [],
  isStreaming: false,

  addMessage: (msg) => {
    const id = uuidv4();
    set((state) => ({
      messages: [...state.messages, { ...msg, id, createdAt: new Date() }]
    }));
    return id;
  },

  updateMessage: (id, partial) => set((state) => ({
    messages: state.messages.map(m => m.id === id ? { ...m, ...partial } : m)
  })),

  addPendingAction: (action) => {
    const id = uuidv4();
    set((state) => ({
      pendingActions: [...state.pendingActions, { ...action, id, createdAt: new Date() }]
    }));
    return id;
  },

  resolvePendingAction: (id, status) => set((state) => ({
    pendingActions: state.pendingActions.map(a => a.id === id ? { ...a, status } : a)
  })),

  setStreaming: (isStreaming) => set({ isStreaming }),

  clearMessages: () => set({ messages: [], pendingActions: [] })
}));
