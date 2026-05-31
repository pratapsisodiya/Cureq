import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { api, BACKEND_URL } from '../utils/api';

export interface TokenItem {
  id: string;
  tokenNo: string;
  patientName: string;
  patientPhone: string;
  patientId: string | null;
  appointmentId: string | null;
  type: 'GENERAL' | 'PRIORITY' | 'EMERGENCY';
  visitType: 'NEW' | 'FOLLOW_UP' | 'EMERGENCY';
  status: 'WAITING' | 'IN_CONSULTATION' | 'SERVED' | 'SKIPPED' | 'NO_SHOW';
  chiefComplaint: string | null;
  notes: string | null;
  estimatedWait: number;
  checkInTime: string;
  startTime: string | null;
  queueOrder: number;
  seatStatus: 'SEATED' | 'WAITING_OUTSIDE';
  consultationFee?: number | null;
}

export interface DoctorBreakInfo {
  doctorName: string;
  resumeAt: string | null;
}

// Granular per-action loading flags so the UI can show targeted spinners
interface LoadingFlags {
  queue: boolean;     // fetchQueue
  callNext: boolean;
  skip: boolean;
  noShow: boolean;
  reorder: boolean;
  addToken: boolean;
  seats: boolean;
}

interface QueueState {
  activeQueue: TokenItem[];
  servedToday: TokenItem[];
  skippedToday: TokenItem[];
  noShowToday: TokenItem[];

  socket: Socket | null;
  isConnected: boolean;
  lastCalledToken: { tokenNo: string; doctorName: string } | null;
  broadcastAlert: string | null;
  doctorBreakStatus: Record<string, DoctorBreakInfo>;

  // loading.queue replaces the old flat `loading` boolean
  loading: LoadingFlags;
  error: string | null;

  // Actions
  fetchQueue: (branchId: string, doctorId: string) => Promise<void>;
  initSocket: (branchId: string) => void;
  disconnectSocket: () => void;
  clearError: () => void;

  // Doctor operations
  callNext: (branchId: string, doctorId: string, notes?: string, followUpDate?: string) => Promise<void>;
  skipToken: (branchId: string, doctorId: string, tokenId: string) => Promise<void>;
  markNoShow: (branchId: string, doctorId: string, tokenId: string) => Promise<void>;
  recallToken: (branchId: string, tokenNo: string, doctorName: string) => Promise<void>;
  reorderQueue: (branchId: string, doctorId: string, tokenIds: string[]) => Promise<void>;
  addToken: (branchId: string, payload: Record<string, unknown>) => Promise<void>;
  updateSeatsCapacity: (clinicId: string, branchId: string, seats: number) => Promise<void>;
}

const DEFAULT_LOADING: LoadingFlags = {
  queue: false,
  callNext: false,
  skip: false,
  noShow: false,
  reorder: false,
  addToken: false,
  seats: false,
};

function setLoading(key: keyof LoadingFlags, value: boolean) {
  return (state: QueueState) => ({
    loading: { ...state.loading, [key]: value },
  });
}

export const useQueueStore = create<QueueState>((set, get) => ({
  activeQueue: [],
  servedToday: [],
  skippedToday: [],
  noShowToday: [],
  socket: null,
  isConnected: false,
  lastCalledToken: null,
  broadcastAlert: null,
  doctorBreakStatus: {},
  loading: DEFAULT_LOADING,
  error: null,

  clearError: () => set({ error: null }),

  fetchQueue: async (branchId, doctorId) => {
    set(setLoading('queue', true));
    set({ error: null });
    try {
      const data = await api.get<{
        active: TokenItem[];
        served: TokenItem[];
        skipped: TokenItem[];
        noshow: TokenItem[];
      }>(`/queues/${branchId}/live?doctorId=${doctorId}`);

      set({
        activeQueue: data.active ?? [],
        servedToday: data.served ?? [],
        skippedToday: data.skipped ?? [],
        noShowToday: data.noshow ?? [],
      });
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      set(setLoading('queue', false));
    }
  },

  initSocket: (branchId) => {
    // Prevent duplicate socket connections
    const existing = get().socket;
    if (existing?.connected) return;

    const newSocket = io(BACKEND_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
    });

    newSocket.on('connect', () => {
      set({ isConnected: true });
      newSocket.emit('join:branch', branchId);
    });

    newSocket.on('disconnect', () => {
      set({ isConnected: false });
    });

    // Rejoin the branch room on every reconnect so state stays current
    newSocket.on('reconnect', () => {
      newSocket.emit('join:branch', branchId);
    });

    newSocket.on('queue:updated', (data: { doctorId: string; queue: TokenItem[] }) => {
      set({ activeQueue: data.queue });
    });

    newSocket.on('token:called', (data: { tokenNo: string; doctorName: string }) => {
      set({ lastCalledToken: data });

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Token number ${data.tokenNo.replace('-', ' ')}, please proceed to Doctor ${data.doctorName}'s chamber.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }

      setTimeout(() => {
        set((state) =>
          state.lastCalledToken?.tokenNo === data.tokenNo
            ? { lastCalledToken: null }
            : {}
        );
      }, 10000);
    });

    newSocket.on('broadcast:alert', (data: { message: string }) => {
      set({ broadcastAlert: data.message });
      setTimeout(() => set({ broadcastAlert: null }), 15000);
    });

    newSocket.on(
      'doctor:break',
      (data: { doctorId: string; doctorName: string; onBreak: boolean; resumeAt: string | null }) => {
        set((state) => {
          const updated = { ...state.doctorBreakStatus };
          if (data.onBreak) {
            updated[data.doctorId] = { doctorName: data.doctorName, resumeAt: data.resumeAt };
          } else {
            delete updated[data.doctorId];
          }
          return { doctorBreakStatus: updated };
        });
      }
    );

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      set({ socket: null, isConnected: false });
    }
  },

  callNext: async (branchId, doctorId, notes, followUpDate) => {
    set(setLoading('callNext', true));
    try {
      await api.post(`/queues/${branchId}/next`, {
        doctorId,
        notes,
        followUpDate: followUpDate ?? null,
      });
      // State update comes through queue:updated socket event
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set(setLoading('callNext', false));
    }
  },

  skipToken: async (branchId, doctorId, tokenId) => {
    set(setLoading('skip', true));
    try {
      await api.post(`/queues/${branchId}/skip`, { tokenId, doctorId });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set(setLoading('skip', false));
    }
  },

  markNoShow: async (branchId, doctorId, tokenId) => {
    set(setLoading('noShow', true));
    try {
      await api.post(`/queues/${branchId}/noshow`, { tokenId, doctorId });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set(setLoading('noShow', false));
    }
  },

  recallToken: async (branchId, tokenNo, doctorName) => {
    try {
      await api.post(`/queues/${branchId}/recall`, { tokenNo, doctorName });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  reorderQueue: async (branchId, doctorId, tokenIds) => {
    set(setLoading('reorder', true));
    try {
      await api.post(`/queues/${branchId}/reorder`, { doctorId, tokenIds });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set(setLoading('reorder', false));
    }
  },

  addToken: async (branchId, payload) => {
    set(setLoading('addToken', true));
    try {
      await api.post(`/queues/${branchId}/token`, payload);
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set(setLoading('addToken', false));
    }
  },

  updateSeatsCapacity: async (clinicId, branchId, seats) => {
    set(setLoading('seats', true));
    try {
      await api.put(`/clinics/${clinicId}/branches/${branchId}/seats`, {
        waitingSeats: seats,
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    } finally {
      set(setLoading('seats', false));
    }
  },
}));
