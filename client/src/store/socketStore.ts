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

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
export type MatchmakingState = 'idle' | 'queueing' | 'matched';

// Module-level reconnect state
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isIntentionalDisconnect = false;

const RECONNECT_BASE_MS = 1000;
const RECONNECT_CAP_MS = 30000;
const RECONNECT_MAX_ATTEMPTS = 5;

function calcReconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt - 1), RECONNECT_CAP_MS);
}

function scheduleReconnect(
  socket: GameSocket,
  attempt: number,
  set: (partial: Partial<SocketStore>) => void,
  get: () => SocketStore
): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (attempt > RECONNECT_MAX_ATTEMPTS) {
    set({ status: 'error', errorMessage: 'Connection lost — return to menu' });
    return;
  }
  set({ status: 'reconnecting', reconnectAttempts: attempt });
  const delay = calcReconnectDelay(attempt);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (get().status === 'reconnecting') {
      socket.connect();
    }
  }, delay);
}

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

  // Reconnect
  reconnectAttempts: number;

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

  reconnectAttempts: 0,

  connect: (token, guestName) => {
    const existing = get().socket;
    if (existing && existing.connected) return;
    if (existing) existing.disconnect();

    // Clear any pending reconnect from a previous connection
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    isIntentionalDisconnect = false;

    set({ status: 'connecting', errorMessage: null, reconnectAttempts: 0 });

    const socket: GameSocket = io(SOCKET_URL, {
      auth: { token, guestName },
      autoConnect: true,
      reconnection: false,
    });

    socket.on('connect', () => {
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      set({ status: 'connected', errorMessage: null, reconnectAttempts: 0 });
    });

    socket.on('disconnect', (reason) => {
      if (isIntentionalDisconnect || reason === 'io client disconnect') {
        set({ status: 'disconnected' });
        return;
      }
      scheduleReconnect(socket, 1, set, get);
    });

    socket.on('connect_error', (err) => {
      if (get().status === 'reconnecting') {
        const nextAttempt = get().reconnectAttempts + 1;
        scheduleReconnect(socket, nextAttempt, set, get);
      } else {
        set({ status: 'error', errorMessage: err.message });
      }
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
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    isIntentionalDisconnect = true;
    const socket = get().socket;
    if (socket) socket.disconnect();
    set({
      socket: null,
      status: 'disconnected',
      reconnectAttempts: 0,
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
