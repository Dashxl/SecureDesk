import { create } from 'zustand';
import { AuditEntry } from '@/types/audit';

interface AuditState {
  logs: AuditEntry[];
  isLoading: boolean;
  error: string | null;
  setLogs: (logs: AuditEntry[]) => void;
  addLog: (log: AuditEntry) => void;
  upsertLogs: (logs: AuditEntry[]) => void;
  updateLog: (id: string, partial: Partial<AuditEntry>) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  // Filters
  filterService: string | null;
  filterRiskType: string | null;
  filterStatus: string | null;
  setFilterService: (service: string | null) => void;
  setFilterRiskType: (riskType: string | null) => void;
  setFilterStatus: (status: string | null) => void;
}

export const useAuditStore = create<AuditState>()((set) => ({
  logs: [],
  isLoading: false,
  error: null,
  filterService: null,
  filterRiskType: null,
  filterStatus: null,

  setLogs: (logs) => set({ logs }),
  addLog: (log) => set((state) => ({ logs: [log, ...state.logs] })),
  upsertLogs: (incomingLogs) =>
    set((state) => {
      const merged = [...state.logs];

      for (const incoming of incomingLogs) {
        const existingIndex = merged.findIndex((log) => log.id === incoming.id);

        if (existingIndex >= 0) {
          merged[existingIndex] = { ...merged[existingIndex], ...incoming };
        } else {
          merged.unshift(incoming);
        }
      }

      merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return { logs: merged };
    }),
  updateLog: (id, partial) =>
    set((state) => ({
      logs: state.logs.map((log) => (log.id === id ? { ...log, ...partial } : log)),
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilterService: (service) => set({ filterService: service }),
  setFilterRiskType: (riskType) => set({ filterRiskType: riskType }),
  setFilterStatus: (status) => set({ filterStatus: status }),
}));
