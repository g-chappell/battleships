import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  PublicGameState,
  ChatMessage,
  PlayerView,
  MatchSummary,
} from '@shared/index';
import type { ShipPlacement, Coordinate, AbilityType } from '@shared/index';
import { SOCKET_URL } from '../services/apiClient';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type MatchmakingState = 'idle' | 'queueing' | 'matched';

interface SocketStore {
  socket: GameSocket | null;
  status: ConnectionStatus;
  errorMessage: string | null;

  // Matchmaking
  matchmakingState: MatchmakingState;
  queueElapsed: number;
  queueSize: number;

  // Room
  roomId: string | null;
  privateCode: string | null;
  opponent: PlayerView | null;
  isRanked: boolean;

  // Game state (server-authoritative snapshot)
  gameState: PublicGameState | null;
  matchSummary: MatchSummary | null;

  // Chat
  chatMessages: ChatMessage[];
  mutedOpponent: boolean;

  // Disconnect status
  opponentDisconnected: boolean;
  opponentSecondsRemaining: number;

  // Rematch
  selfRequestedRematch: boolean;
  opponentRequestedRematch: boolean;

  // Actions
  connect: (token: string | null, guestName?: string) => void;
  disconnect: () => void;
  joinMatchmaking: (selectedAbilities: AbilityType[]) => void;
  leaveMatchmaking: () => void;
  createPrivateRoom: (selectedAbilities: AbilityType[]) => Promise<{ code: string } | { error: string }>;
  joinPrivateRoom: (code: string, selectedAbilities: AbilityType[]) => Promise<{ ok: true } | { error: string }>;
  submitPlacement: (placements: ShipPlacement[]) => void;
  fire: (coord: Coordinate) => void;
  useAbility: (ability: AbilityType, coord: Coordinate) => void;
  resign: () => void;
  sendChat: (text: string) => void;
  toggleMuteOpponent: () => void;
  requestRematch: () => void;
  resetRoom: () => void;
}

export const useSocketStore = create<SocketStore>((set, get) => ({
  socket: null,
  status: 'disconnected',
  errorMessage: null,

  matchmakingState: 'idle',
  queueElapsed: 0,
  queueSize: 0,

  roomId: null,
  privateCode: null,
  opponent: null,
  isRanked: false,

  gameState: null,
  matchSummary: null,

  chatMessages: [],
  mutedOpponent: false,

  opponentDisconnected: false,
  opponentSecondsRemaining: 0,

  selfRequestedRematch: false,
  opponentRequestedRematch: false,

  connect: (token, guestName) => {
    const existing = get().socket;
    if (existing && existing.connected) return;
    if (existing) existing.disconnect();

    set({ status: 'connecting', errorMessage: null });

    const socket: GameSocket = io(SOCKET_URL, {
      auth: { token, guestName },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => {
      set({ status: 'connected', errorMessage: null });
    });

    socket.on('disconnect', () => {
      set({ status: 'disconnected' });
    });

    socket.on('connect_error', (err) => {
      set({ status: 'error', errorMessage: err.message });
    });

    // Matchmaking
    socket.on('mm:waiting', ({ queueSize, elapsed }) => {
      set({ matchmakingState: 'queueing', queueSize, queueElapsed: elapsed });
    });

    socket.on('mm:matched', ({ roomId, opponent, isRanked }) => {
      set({
        matchmakingState: 'matched',
        roomId,
        opponent,
        isRanked,
        chatMessages: [],
        gameState: null,
        matchSummary: null,
        selfRequestedRematch: false,
        opponentRequestedRematch: false,
      });
    });

    socket.on('mm:cancelled', () => {
      set({ matchmakingState: 'idle' });
    });

    // Private rooms
    socket.on('room:created', ({ code, roomId }) => {
      set({ privateCode: code, roomId });
    });

    socket.on('room:opponent_joined', ({ opponent }) => {
      set({ opponent });
    });

    // Game state
    socket.on('game:state', (state) => {
      set({ gameState: state });
    });

    socket.on('game:opponent_action', () => {
      // Opponent fired/used ability — game:state will follow with new state
    });

    socket.on('game:end', (summary) => {
      set({ matchSummary: summary });
    });

    socket.on('game:opponent_disconnected', ({ secondsRemaining }) => {
      set({ opponentDisconnected: true, opponentSecondsRemaining: secondsRemaining });
    });

    socket.on('game:opponent_reconnected', () => {
      set({ opponentDisconnected: false, opponentSecondsRemaining: 0 });
    });

    socket.on('game:rematch_pending', ({ from }) => {
      if (from === 'opponent') {
        set({ opponentRequestedRematch: true });
      }
    });

    // Chat
    socket.on('chat:message', (msg) => {
      const isOwn = msg.fromId === socket.id || (get().opponent?.id !== msg.fromId);
      // Filter muted opponent messages
      if (!isOwn && get().mutedOpponent) return;
      set((s) => ({
        chatMessages: [...s.chatMessages, msg].slice(-50),
      }));
    });

    socket.on('error', ({ code, message }) => {
      console.warn(`[socket] error ${code}: ${message}`);
      set({ errorMessage: `${code}: ${message}` });
    });

    set({ socket });
  },

  disconnect: () => {
    const socket = get().socket;
    if (socket) socket.disconnect();
    set({
      socket: null,
      status: 'disconnected',
      matchmakingState: 'idle',
      roomId: null,
      privateCode: null,
      opponent: null,
      gameState: null,
      matchSummary: null,
      chatMessages: [],
      opponentDisconnected: false,
      selfRequestedRematch: false,
      opponentRequestedRematch: false,
    });
  },

  joinMatchmaking: (selectedAbilities) => {
    const socket = get().socket;
    if (!socket) return;
    set({ matchmakingState: 'queueing', queueElapsed: 0 });
    socket.emit('mm:join', { selectedAbilities });
  },

  leaveMatchmaking: () => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('mm:leave');
    set({ matchmakingState: 'idle' });
  },

  createPrivateRoom: (selectedAbilities) => {
    return new Promise((resolve) => {
      const socket = get().socket;
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit('room:create', { selectedAbilities }, (res) => {
        if ('code' in res) {
          set({ privateCode: res.code });
        }
        resolve(res);
      });
    });
  },

  joinPrivateRoom: (code, selectedAbilities) => {
    return new Promise((resolve) => {
      const socket = get().socket;
      if (!socket) {
        resolve({ error: 'Not connected' });
        return;
      }
      socket.emit('room:join', { code, selectedAbilities }, (res) => {
        resolve(res);
      });
    });
  },

  submitPlacement: (placements) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('game:place', { placements });
  },

  fire: (coord) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('game:fire', { coord });
  },

  useAbility: (ability, coord) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('game:ability', { ability, coord });
  },

  resign: () => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('game:resign');
  },

  sendChat: (text) => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('chat:message', { text });
  },

  toggleMuteOpponent: () => {
    set((s) => ({ mutedOpponent: !s.mutedOpponent }));
  },

  requestRematch: () => {
    const socket = get().socket;
    if (!socket) return;
    socket.emit('game:rematch_request');
    set({ selfRequestedRematch: true });
  },

  resetRoom: () => {
    set({
      roomId: null,
      privateCode: null,
      opponent: null,
      gameState: null,
      matchSummary: null,
      chatMessages: [],
      opponentDisconnected: false,
      selfRequestedRematch: false,
      opponentRequestedRematch: false,
      matchmakingState: 'idle',
    });
  },
}));
