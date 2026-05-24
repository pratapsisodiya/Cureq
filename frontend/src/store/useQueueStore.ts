import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { apiRequest, BACKEND_URL } from '../utils/api';

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

interface QueueState {
  activeQueue: TokenItem[];
  servedToday: TokenItem[];
  skippedToday: TokenItem[];
  noShowToday: TokenItem[];

  socket: Socket | null;
  lastCalledToken: { tokenNo: string; doctorName: string } | null;
  broadcastAlert: string | null;
  doctorBreakStatus: Record<string, DoctorBreakInfo>;
  loading: boolean;
  error: string | null;

  fetchQueue: (branchId: string, doctorId: string) => Promise<void>;
  initSocket: (branchId: string) => void;
  disconnectSocket: () => void;
  
  // Doctor operations
  callNext: (branchId: string, doctorId: string, notes?: string, followUpDate?: string) => Promise<void>;
  skipToken: (branchId: string, doctorId: string, tokenId: string) => Promise<void>;
  markNoShow: (branchId: string, doctorId: string, tokenId: string) => Promise<void>;
  recallToken: (branchId: string, tokenNo: string, doctorName: string) => Promise<void>;
  reorderQueue: (branchId: string, doctorId: string, tokenIds: string[]) => Promise<void>;
  addToken: (branchId: string, payload: any) => Promise<void>;
  updateSeatsCapacity: (clinicId: string, branchId: string, seats: number) => Promise<void>;
}

export const useQueueStore = create<QueueState>((set, get) => ({
  activeQueue: [],
  servedToday: [],
  skippedToday: [],
  noShowToday: [],
  socket: null,
  lastCalledToken: null,
  broadcastAlert: null,
  doctorBreakStatus: {},
  loading: false,
  error: null,

  fetchQueue: async (branchId, doctorId) => {
    set({ loading: true, error: null });
    try {
      const data = await apiRequest(`/queues/${branchId}/live?doctorId=${doctorId}`);
      set({
        activeQueue: data.active || [],
        servedToday: data.served || [],
        skippedToday: data.skipped || [],
        noShowToday: data.noshow || [],
        loading: false,
      });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  initSocket: (branchId) => {
    const currentSocket = get().socket;
    if (currentSocket) return; // Already initialized

    const socketUrl = BACKEND_URL;
    const newSocket = io(socketUrl);

    newSocket.on('connect', () => {
      console.log('📶 Connected to CureQ Socket Server');
      newSocket.emit('join:branch', branchId);
    });

    newSocket.on('queue:updated', (data: { doctorId: string; queue: TokenItem[] }) => {
      // Updates the local active queue immediately
      set({ activeQueue: data.queue });
    });

    newSocket.on('token:called', (data: { tokenNo: string; doctorName: string }) => {
      set({ lastCalledToken: data });
      
      // Text-To-Speech audio announcement for waiting rooms
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `Token number ${data.tokenNo.replace('-', ' ')}, please proceed to Doctor ${data.doctorName}'s chamber.`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
      
      // Auto-clear called state banner after 10 seconds
      setTimeout(() => {
        set((state) => {
          if (state.lastCalledToken?.tokenNo === data.tokenNo) {
            return { lastCalledToken: null };
          }
          return {};
        });
      }, 10000);
    });

    newSocket.on('broadcast:alert', (data: { message: string }) => {
      set({ broadcastAlert: data.message });
      setTimeout(() => set({ broadcastAlert: null }), 15000);
    });

    newSocket.on('doctor:break', (data: { doctorId: string; doctorName: string; onBreak: boolean; resumeAt: string | null }) => {
      set(state => {
        const updated = { ...state.doctorBreakStatus };
        if (data.onBreak) {
          updated[data.doctorId] = { doctorName: data.doctorName, resumeAt: data.resumeAt };
        } else {
          delete updated[data.doctorId];
        }
        return { doctorBreakStatus: updated };
      });
    });

    set({ socket: newSocket });
  },

  disconnectSocket: () => {
    const s = get().socket;
    if (s) {
      s.disconnect();
      set({ socket: null });
    }
  },

  callNext: async (branchId, doctorId, notes, followUpDate) => {
    try {
      await apiRequest(`/queues/${branchId}/next`, {
        method: 'POST',
        body: JSON.stringify({ doctorId, notes, followUpDate: followUpDate || null }),
      });
      // Rest of state is synchronized in the queue:updated event callback
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  skipToken: async (branchId, doctorId, tokenId) => {
    try {
      await apiRequest(`/queues/${branchId}/skip`, {
        method: 'POST',
        body: JSON.stringify({ tokenId, doctorId }),
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  markNoShow: async (branchId, doctorId, tokenId) => {
    try {
      await apiRequest(`/queues/${branchId}/noshow`, {
        method: 'POST',
        body: JSON.stringify({ tokenId, doctorId }),
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  recallToken: async (branchId, tokenNo, doctorName) => {
    try {
      await apiRequest(`/queues/${branchId}/recall`, {
        method: 'POST',
        body: JSON.stringify({ tokenNo, doctorName }),
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  reorderQueue: async (branchId, doctorId, tokenIds) => {
    try {
      await apiRequest(`/queues/${branchId}/reorder`, {
        method: 'POST',
        body: JSON.stringify({ doctorId, tokenIds }),
      });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addToken: async (branchId, payload) => {
    try {
      await apiRequest(`/queues/${branchId}/token`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
  
  updateSeatsCapacity: async (clinicId, branchId, seats) => {
    try {
      await apiRequest(`/clinics/${clinicId}/branches/${branchId}/seats`, {
        method: 'PUT',
        body: JSON.stringify({ waitingSeats: seats }),
      });
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },
}));
