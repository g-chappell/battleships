import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock audio service before importing the store
vi.mock('../services/audio', () => ({
  setVolume: vi.fn(),
  setMuted: vi.fn(),
  setSfxVolume: vi.fn(),
  setMusicVolume: vi.fn(),
  startAmbientLoop: vi.fn(),
  stopAmbientLoop: vi.fn(),
}));

// Mock socketStore so we can control the socket object
vi.mock('../store/socketStore', () => ({
  useSocketStore: {
    getState: vi.fn(),
  },
}));

import { useSpectatorStore } from '../store/spectatorStore';
import { useSocketStore } from '../store/socketStore';

const mockGetState = useSocketStore.getState as ReturnType<typeof vi.fn>;

function makeSocket() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    off: vi.fn(),
    _trigger: (event: string, ...args: unknown[]) => {
      (listeners[event] ?? []).forEach((cb) => cb(...args));
    },
  };
}

function resetStore() {
  useSpectatorStore.setState({
    gameState: null,
    chat: [],
    spectatorCount: 0,
    spectatableRooms: [],
    isSpectating: false,
    ended: false,
    winnerId: null,
  });
}

describe('spectatorStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('has correct initial state', () => {
    const state = useSpectatorStore.getState();
    expect(state.gameState).toBeNull();
    expect(state.chat).toEqual([]);
    expect(state.spectatorCount).toBe(0);
    expect(state.spectatableRooms).toEqual([]);
    expect(state.isSpectating).toBe(false);
    expect(state.ended).toBe(false);
    expect(state.winnerId).toBeNull();
  });

  // ── joinAsSpectator ────────────────────────────────────────────────────────

  it('joinAsSpectator returns error when no socket', async () => {
    mockGetState.mockReturnValue({ socket: null });
    const result = await useSpectatorStore.getState().joinAsSpectator('room-1');
    expect(result).toEqual({ error: 'Not connected' });
    expect(useSpectatorStore.getState().isSpectating).toBe(false);
  });

  it('joinAsSpectator resolves ok and sets isSpectating on success', async () => {
    const socket = makeSocket();
    socket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ ok: true });
    });
    mockGetState.mockReturnValue({ socket });

    const result = await useSpectatorStore.getState().joinAsSpectator('room-1');

    expect(result).toEqual({ ok: true });
    const state = useSpectatorStore.getState();
    expect(state.isSpectating).toBe(true);
    expect(state.ended).toBe(false);
    expect(state.winnerId).toBeNull();
    expect(state.chat).toEqual([]);
  });

  it('joinAsSpectator resolves error on server rejection', async () => {
    const socket = makeSocket();
    socket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ error: 'Room not found' });
    });
    mockGetState.mockReturnValue({ socket });

    const result = await useSpectatorStore.getState().joinAsSpectator('bad-room');

    expect(result).toEqual({ error: 'Room not found' });
    expect(useSpectatorStore.getState().isSpectating).toBe(false);
  });

  it('joinAsSpectator registers spectator:state listener that updates gameState and spectatorCount', async () => {
    const socket = makeSocket();
    socket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ ok: true });
    });
    mockGetState.mockReturnValue({ socket });

    await useSpectatorStore.getState().joinAsSpectator('room-1');

    const mockState = {
      roomId: 'room-1',
      phase: 'playing' as const,
      currentTurn: 'player1' as const,
      turnCount: 5,
      winner: null,
      player1: { username: 'Alice', rating: 1200 },
      player2: { username: 'Bob', rating: 1100 },
      board1: { cells: [], sunkShips: [] },
      board2: { cells: [], sunkShips: [] },
      spectatorCount: 3,
    };

    socket._trigger('spectator:state', mockState);

    const state = useSpectatorStore.getState();
    expect(state.gameState).toEqual(mockState);
    expect(state.spectatorCount).toBe(3);
  });

  it('joinAsSpectator registers spectator:chat listener that appends messages', async () => {
    const socket = makeSocket();
    socket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ ok: true });
    });
    mockGetState.mockReturnValue({ socket });

    await useSpectatorStore.getState().joinAsSpectator('room-1');

    const msg1 = { id: '1', username: 'Alice', text: 'Hello', timestamp: 1000 };
    const msg2 = { id: '2', username: 'Bob', text: 'Hi', timestamp: 2000 };

    socket._trigger('spectator:chat', msg1);
    socket._trigger('spectator:chat', msg2);

    const state = useSpectatorStore.getState();
    expect(state.chat).toHaveLength(2);
    expect(state.chat[0]).toEqual(msg1);
    expect(state.chat[1]).toEqual(msg2);
  });

  it('joinAsSpectator registers spectator:count listener that updates spectatorCount', async () => {
    const socket = makeSocket();
    socket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ ok: true });
    });
    mockGetState.mockReturnValue({ socket });

    await useSpectatorStore.getState().joinAsSpectator('room-1');

    socket._trigger('spectator:count', { count: 7 });

    expect(useSpectatorStore.getState().spectatorCount).toBe(7);
  });

  it('joinAsSpectator registers spectator:ended listener that sets ended and winnerId', async () => {
    const socket = makeSocket();
    socket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ ok: true });
    });
    mockGetState.mockReturnValue({ socket });

    await useSpectatorStore.getState().joinAsSpectator('room-1');

    socket._trigger('spectator:ended', { winnerId: 'player-42' });

    const state = useSpectatorStore.getState();
    expect(state.ended).toBe(true);
    expect(state.winnerId).toBe('player-42');
  });

  // ── chat buffer cap ────────────────────────────────────────────────────────

  it('chat buffer stays capped at 100 messages', async () => {
    const socket = makeSocket();
    socket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ ok: true });
    });
    mockGetState.mockReturnValue({ socket });

    await useSpectatorStore.getState().joinAsSpectator('room-1');

    for (let i = 0; i < 105; i++) {
      socket._trigger('spectator:chat', { id: String(i), username: 'u', text: `msg${i}`, timestamp: i });
    }

    const chat = useSpectatorStore.getState().chat;
    expect(chat.length).toBeLessThanOrEqual(100);
    // Most recent messages should be last
    expect(chat[chat.length - 1].text).toBe('msg104');
  });

  // ── leaveSpectating ────────────────────────────────────────────────────────

  it('leaveSpectating emits spectator:leave and resets state', () => {
    const socket = makeSocket();
    mockGetState.mockReturnValue({ socket });

    useSpectatorStore.setState({
      isSpectating: true,
      spectatorCount: 5,
      ended: true,
      winnerId: 'player-1',
    });

    useSpectatorStore.getState().leaveSpectating();

    expect(socket.emit).toHaveBeenCalledWith('spectator:leave');
    expect(socket.off).toHaveBeenCalledWith('spectator:state');
    expect(socket.off).toHaveBeenCalledWith('spectator:chat');
    expect(socket.off).toHaveBeenCalledWith('spectator:count');
    expect(socket.off).toHaveBeenCalledWith('spectator:ended');

    const state = useSpectatorStore.getState();
    expect(state.isSpectating).toBe(false);
    expect(state.gameState).toBeNull();
    expect(state.chat).toEqual([]);
    expect(state.spectatorCount).toBe(0);
    expect(state.ended).toBe(false);
    expect(state.winnerId).toBeNull();
  });

  it('leaveSpectating does nothing when no socket', () => {
    mockGetState.mockReturnValue({ socket: null });

    useSpectatorStore.setState({ isSpectating: true });

    useSpectatorStore.getState().leaveSpectating();

    // State still reset even without socket
    expect(useSpectatorStore.getState().isSpectating).toBe(false);
  });

  // ── sendChat ───────────────────────────────────────────────────────────────

  it('sendChat emits spectator:chat with trimmed text', () => {
    const socket = makeSocket();
    mockGetState.mockReturnValue({ socket });

    useSpectatorStore.getState().sendChat('  hello world  ');

    expect(socket.emit).toHaveBeenCalledWith('spectator:chat', { text: 'hello world' });
  });

  it('sendChat does nothing for empty or whitespace-only text', () => {
    const socket = makeSocket();
    mockGetState.mockReturnValue({ socket });

    useSpectatorStore.getState().sendChat('   ');
    useSpectatorStore.getState().sendChat('');

    expect(socket.emit).not.toHaveBeenCalled();
  });

  it('sendChat does nothing when no socket', () => {
    mockGetState.mockReturnValue({ socket: null });

    // Should not throw
    useSpectatorStore.getState().sendChat('hello');
  });

  // ── fetchRooms ─────────────────────────────────────────────────────────────

  it('fetchRooms emits spectator:list and updates spectatableRooms', () => {
    const socket = makeSocket();
    const mockRooms = [
      { roomId: 'r1', player1: 'Alice', player2: 'Bob', turnCount: 10, spectatorCount: 2 },
      { roomId: 'r2', player1: 'Carol', player2: 'Dave', turnCount: 3, spectatorCount: 0 },
    ];

    socket.emit.mockImplementation((_event: string, ack: (rooms: unknown) => void) => {
      ack(mockRooms);
    });
    mockGetState.mockReturnValue({ socket });

    useSpectatorStore.getState().fetchRooms();

    expect(socket.emit).toHaveBeenCalledWith('spectator:list', expect.any(Function));
    expect(useSpectatorStore.getState().spectatableRooms).toEqual(mockRooms);
  });

  it('fetchRooms does nothing when no socket', () => {
    mockGetState.mockReturnValue({ socket: null });

    useSpectatorStore.getState().fetchRooms();

    expect(useSpectatorStore.getState().spectatableRooms).toEqual([]);
  });

  // ── reset ──────────────────────────────────────────────────────────────────

  it('reset clears all state', () => {
    useSpectatorStore.setState({
      gameState: { roomId: 'r1', phase: 'playing', currentTurn: 'player1', turnCount: 5, winner: null, player1: { username: 'A', rating: 1000 }, player2: { username: 'B', rating: 1000 }, board1: { cells: [], sunkShips: [] }, board2: { cells: [], sunkShips: [] }, spectatorCount: 2 },
      chat: [{ id: '1', username: 'x', text: 'hi', timestamp: 0 }],
      spectatorCount: 2,
      spectatableRooms: [{ roomId: 'r1', player1: 'A', player2: 'B', turnCount: 5, spectatorCount: 2 }],
      isSpectating: true,
      ended: true,
      winnerId: 'player-1',
    });

    useSpectatorStore.getState().reset();

    const state = useSpectatorStore.getState();
    expect(state.gameState).toBeNull();
    expect(state.chat).toEqual([]);
    expect(state.spectatorCount).toBe(0);
    expect(state.spectatableRooms).toEqual([]);
    expect(state.isSpectating).toBe(false);
    expect(state.ended).toBe(false);
    expect(state.winnerId).toBeNull();
  });
});
