import { create } from 'zustand';
import type {
  SpectatorGameState,
  SpectatorChatMessage,
  SpectatableRoom,
} from '@shared/sockets';
import { useSocketStore } from './socketStore';

interface SpectatorStore {
  gameState: SpectatorGameState | null;
  chat: SpectatorChatMessage[];
  spectatorCount: number;
  spectatableRooms: SpectatableRoom[];
  isSpectating: boolean;
  ended: boolean;
  winnerId: string | null;

  joinAsSpectator: (roomId: string) => Promise<{ ok: true } | { error: string }>;
  leaveSpectating: () => void;
  sendChat: (text: string) => void;
  fetchRooms: () => void;
  reset: () => void;
}

export const useSpectatorStore = create<SpectatorStore>((set) => ({
  gameState: null,
  chat: [],
  spectatorCount: 0,
  spectatableRooms: [],
  isSpectating: false,
  ended: false,
  winnerId: null,

  joinAsSpectator: async (roomId) => {
    const socket = useSocketStore.getState().socket;
    if (!socket) return { error: 'Not connected' };

    return new Promise((resolve) => {
      socket.emit('spectator:join', { roomId }, (res) => {
        if ('ok' in res) {
          set({ isSpectating: true, ended: false, winnerId: null, chat: [] });

          socket.on('spectator:state', (state) => {
            set({ gameState: state, spectatorCount: state.spectatorCount });
          });
          socket.on('spectator:chat', (msg) => {
            set((s) => ({ chat: [...s.chat.slice(-99), msg] }));
          });
          socket.on('spectator:count', ({ count }) => {
            set({ spectatorCount: count });
          });
          socket.on('spectator:ended', ({ winnerId }) => {
            set({ ended: true, winnerId });
          });

          resolve({ ok: true });
        } else {
          resolve(res);
        }
      });
    });
  },

  leaveSpectating: () => {
    const socket = useSocketStore.getState().socket;
    if (socket) {
      socket.emit('spectator:leave');
      socket.off('spectator:state');
      socket.off('spectator:chat');
      socket.off('spectator:count');
      socket.off('spectator:ended');
    }
    set({ isSpectating: false, gameState: null, chat: [], spectatorCount: 0, ended: false, winnerId: null });
  },

  sendChat: (text) => {
    const socket = useSocketStore.getState().socket;
    if (socket && text.trim()) {
      socket.emit('spectator:chat', { text: text.trim() });
    }
  },

  fetchRooms: () => {
    const socket = useSocketStore.getState().socket;
    if (socket) {
      socket.emit('spectator:list', (rooms) => {
        set({ spectatableRooms: rooms });
      });
    }
  },

  reset: () => {
    set({ gameState: null, chat: [], spectatorCount: 0, spectatableRooms: [], isSpectating: false, ended: false, winnerId: null });
  },
}));
