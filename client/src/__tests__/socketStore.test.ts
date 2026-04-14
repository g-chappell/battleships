import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock audio service before importing anything from the store tree
vi.mock('../services/audio', () => ({
  setVolume: vi.fn(),
  setMuted: vi.fn(),
  setSfxVolume: vi.fn(),
  setMusicVolume: vi.fn(),
  startAmbientLoop: vi.fn(),
  stopAmbientLoop: vi.fn(),
  isAmbientRunning: vi.fn(),
}));

// Mock socket.io-client so no real network connections are made
const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: mockIo }));

import { useSocketStore } from '../store/socketStore';

// ── Fake socket factory ────────────────────────────────────────────────────────

function makeSocket() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
  return {
    id: 'test-socket-id',
    connected: false,
    emit: vi.fn(),
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    }),
    off: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
    _trigger(event: string, ...args: unknown[]) {
      (listeners[event] ?? []).forEach((cb) => cb(...args));
    },
  };
}

type FakeSocket = ReturnType<typeof makeSocket>;

let mockSocket: FakeSocket;

function resetStore() {
  useSocketStore.setState({
    socket: null,
    status: 'disconnected',
    errorMessage: null,
    reconnectAttempts: 0,
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
  });
}

describe('socketStore — reconnection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockSocket = makeSocket();
    mockIo.mockReturnValue(mockSocket);
    resetStore();
    // connect() registers all event handlers on the mock socket and resets module-level reconnect vars
    useSocketStore.getState().connect('test-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Initial state ────────────────────────────────────────────────────────────

  it('initial state before connect has reconnectAttempts 0 and status disconnected', () => {
    resetStore();
    const s = useSocketStore.getState();
    expect(s.reconnectAttempts).toBe(0);
    expect(s.status).toBe('disconnected');
  });

  it('connect() sets status to connecting', () => {
    expect(useSocketStore.getState().status).toBe('connecting');
    expect(useSocketStore.getState().reconnectAttempts).toBe(0);
  });

  it('connect event sets status to connected and clears reconnectAttempts', () => {
    mockSocket._trigger('connect');
    const s = useSocketStore.getState();
    expect(s.status).toBe('connected');
    expect(s.errorMessage).toBeNull();
    expect(s.reconnectAttempts).toBe(0);
  });

  // ── Unexpected disconnect → reconnect ──────────────────────────────────────

  it('unexpected disconnect sets status to reconnecting with attempt 1', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');
    const s = useSocketStore.getState();
    expect(s.status).toBe('reconnecting');
    expect(s.reconnectAttempts).toBe(1);
  });

  it('reconnect timer fires socket.connect() after 1 second on attempt 1', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');
    expect(mockSocket.connect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(999);
    expect(mockSocket.connect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
  });

  it('successful reconnect after disconnect restores connected status', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');
    vi.advanceTimersByTime(1000);
    // Server accepts reconnect
    mockSocket._trigger('connect');
    const s = useSocketStore.getState();
    expect(s.status).toBe('connected');
    expect(s.reconnectAttempts).toBe(0);
    expect(s.errorMessage).toBeNull();
  });

  it('connect_error during reconnect increments attempt to 2', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');
    vi.advanceTimersByTime(1000); // attempt 1 timer fires → socket.connect()
    mockSocket._trigger('connect_error', new Error('refused'));
    const s = useSocketStore.getState();
    expect(s.status).toBe('reconnecting');
    expect(s.reconnectAttempts).toBe(2);
  });

  it('reconnect delay doubles on each attempt (exponential backoff)', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');

    // Attempt 1: 1000ms
    vi.advanceTimersByTime(1000);
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    mockSocket._trigger('connect_error', new Error('x'));

    // Attempt 2: 2000ms — should not fire at 1999ms
    vi.advanceTimersByTime(1999);
    expect(mockSocket.connect).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(mockSocket.connect).toHaveBeenCalledTimes(2);
    mockSocket._trigger('connect_error', new Error('x'));

    // Attempt 3: 4000ms — should not fire at 3999ms
    vi.advanceTimersByTime(3999);
    expect(mockSocket.connect).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(mockSocket.connect).toHaveBeenCalledTimes(3);
  });

  it('after 5 failed attempts sets error status with connection lost message', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');

    // Attempt 1: 1000ms
    vi.advanceTimersByTime(1000);
    mockSocket._trigger('connect_error', new Error('refused'));
    // Attempt 2: 2000ms
    vi.advanceTimersByTime(2000);
    mockSocket._trigger('connect_error', new Error('refused'));
    // Attempt 3: 4000ms
    vi.advanceTimersByTime(4000);
    mockSocket._trigger('connect_error', new Error('refused'));
    // Attempt 4: 8000ms
    vi.advanceTimersByTime(8000);
    mockSocket._trigger('connect_error', new Error('refused'));
    // Attempt 5: 16000ms
    vi.advanceTimersByTime(16000);
    mockSocket._trigger('connect_error', new Error('refused'));
    // 6th attempt exceeds max → error state

    const s = useSocketStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorMessage).toBe('Connection lost — return to menu');
    // No further timer should be pending
    vi.advanceTimersByTime(60000);
    expect(mockSocket.connect).toHaveBeenCalledTimes(5); // only 5 reconnect attempts total
  });

  // ── Intentional disconnect ────────────────────────────────────────────────

  it('intentional disconnect() does not trigger reconnection', () => {
    mockSocket._trigger('connect');
    useSocketStore.getState().disconnect();
    // Simulate socket firing the disconnect event (as it would in reality)
    mockSocket._trigger('disconnect', 'io client disconnect');
    const s = useSocketStore.getState();
    expect(s.status).toBe('disconnected');
    expect(s.reconnectAttempts).toBe(0);
    // No reconnect attempt should be scheduled
    vi.advanceTimersByTime(10000);
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('disconnect() clears a pending reconnect timer', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');
    // Timer is now pending for reconnect attempt 1
    useSocketStore.getState().disconnect();
    // Advance past when the timer would have fired
    vi.advanceTimersByTime(5000);
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  it('disconnect() resets reconnectAttempts to 0', () => {
    mockSocket._trigger('connect');
    mockSocket._trigger('disconnect', 'transport close');
    // Advance so attempt 1 fires and connect_error increments to 2
    vi.advanceTimersByTime(1000);
    mockSocket._trigger('connect_error', new Error('x'));
    expect(useSocketStore.getState().reconnectAttempts).toBe(2);

    useSocketStore.getState().disconnect();
    expect(useSocketStore.getState().reconnectAttempts).toBe(0);
  });

  // ── Initial connect_error (not during reconnect) ──────────────────────────

  it('connect_error during initial connecting phase sets error status', () => {
    // Status is 'connecting' (set by connect() in beforeEach)
    expect(useSocketStore.getState().status).toBe('connecting');
    mockSocket._trigger('connect_error', new Error('connection refused'));
    const s = useSocketStore.getState();
    expect(s.status).toBe('error');
    expect(s.errorMessage).toBe('connection refused');
    // No reconnect scheduled for initial connection errors
    vi.advanceTimersByTime(5000);
    expect(mockSocket.connect).not.toHaveBeenCalled();
  });

  // ── socket.io-client called with reconnection: false ─────────────────────

  it('connect() creates socket with reconnection disabled', () => {
    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ reconnection: false })
    );
  });
});

// ── Connect setup ────────────────────────────────────────────────────────────

describe('socketStore — connect setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = makeSocket();
    mockIo.mockReturnValue(mockSocket);
    resetStore();
  });

  it('connect() passes auth token in io options', () => {
    useSocketStore.getState().connect('my-secret-token');
    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: expect.objectContaining({ token: 'my-secret-token' }) })
    );
  });

  it('connect() passes guestName in io options', () => {
    useSocketStore.getState().connect(null, 'PirateBob');
    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: expect.objectContaining({ guestName: 'PirateBob' }) })
    );
  });

  it('connect() passes null token when no auth token provided', () => {
    useSocketStore.getState().connect(null);
    expect(mockIo).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: expect.objectContaining({ token: null }) })
    );
  });

  it('connect() skips creating new socket when existing socket is already connected', () => {
    mockSocket.connected = true;
    useSocketStore.setState({ socket: mockSocket as unknown as ReturnType<typeof makeSocket> });
    const secondSocket = makeSocket();
    mockIo.mockReturnValue(secondSocket);
    useSocketStore.getState().connect('token');
    // io() should NOT have been called because socket is already connected
    expect(mockIo).not.toHaveBeenCalled();
  });

  it('connect() disconnects existing unconnected socket before creating a new one', () => {
    const oldSocket = makeSocket();
    useSocketStore.setState({ socket: oldSocket as unknown as ReturnType<typeof makeSocket> });
    useSocketStore.getState().connect('token');
    expect(oldSocket.disconnect).toHaveBeenCalled();
  });
});

// ── Socket events routing ────────────────────────────────────────────────────

describe('socketStore — socket events', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockSocket = makeSocket();
    mockIo.mockReturnValue(mockSocket);
    resetStore();
    useSocketStore.getState().connect('test-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mm:waiting sets matchmakingState, queueSize, and queueElapsed', () => {
    mockSocket._trigger('mm:waiting', { queueSize: 5, elapsed: 30 });
    const s = useSocketStore.getState();
    expect(s.matchmakingState).toBe('queueing');
    expect(s.queueSize).toBe(5);
    expect(s.queueElapsed).toBe(30);
  });

  it('mm:matched sets roomId, opponent, isRanked, and resets transient game state', () => {
    useSocketStore.setState({ chatMessages: [{ id: '1', fromId: 'x', fromUsername: 'x', text: 'hi', timestamp: 0 }], selfRequestedRematch: true });
    const opponent = { id: 'opp-1', username: 'PirateJoe', rating: 1200, isReady: false };
    mockSocket._trigger('mm:matched', { roomId: 'room-42', opponent, isRanked: true });
    const s = useSocketStore.getState();
    expect(s.matchmakingState).toBe('matched');
    expect(s.roomId).toBe('room-42');
    expect(s.opponent).toEqual(opponent);
    expect(s.isRanked).toBe(true);
    expect(s.chatMessages).toEqual([]);
    expect(s.gameState).toBeNull();
    expect(s.matchSummary).toBeNull();
    expect(s.selfRequestedRematch).toBe(false);
    expect(s.opponentRequestedRematch).toBe(false);
  });

  it('mm:cancelled resets matchmakingState to idle', () => {
    useSocketStore.setState({ matchmakingState: 'queueing' });
    mockSocket._trigger('mm:cancelled');
    expect(useSocketStore.getState().matchmakingState).toBe('idle');
  });

  it('room:created sets privateCode and roomId', () => {
    mockSocket._trigger('room:created', { code: 'ABCD', roomId: 'room-private-1' });
    const s = useSocketStore.getState();
    expect(s.privateCode).toBe('ABCD');
    expect(s.roomId).toBe('room-private-1');
  });

  it('room:opponent_joined sets opponent', () => {
    const opponent = { id: 'opp-2', username: 'Blackbeard', rating: 1500, isReady: true };
    mockSocket._trigger('room:opponent_joined', { opponent });
    expect(useSocketStore.getState().opponent).toEqual(opponent);
  });

  it('game:state updates gameState', () => {
    const state = { phase: 'placement', roomId: 'r1' };
    mockSocket._trigger('game:state', state);
    expect(useSocketStore.getState().gameState).toEqual(state);
  });

  it('game:end sets matchSummary', () => {
    const summary = { winnerId: 'player1', turns: 20, durationMs: 60000, selfAccuracy: 0.5, opponentAccuracy: 0.4, selfShipsSunk: 3, opponentShipsSunk: 5 };
    mockSocket._trigger('game:end', summary);
    expect(useSocketStore.getState().matchSummary).toEqual(summary);
  });

  it('game:opponent_disconnected sets opponentDisconnected and secondsRemaining', () => {
    mockSocket._trigger('game:opponent_disconnected', { secondsRemaining: 60 });
    const s = useSocketStore.getState();
    expect(s.opponentDisconnected).toBe(true);
    expect(s.opponentSecondsRemaining).toBe(60);
  });

  it('game:opponent_reconnected clears opponentDisconnected state', () => {
    useSocketStore.setState({ opponentDisconnected: true, opponentSecondsRemaining: 45 });
    mockSocket._trigger('game:opponent_reconnected');
    const s = useSocketStore.getState();
    expect(s.opponentDisconnected).toBe(false);
    expect(s.opponentSecondsRemaining).toBe(0);
  });

  it('game:rematch_pending from opponent sets opponentRequestedRematch', () => {
    mockSocket._trigger('game:rematch_pending', { from: 'opponent' });
    expect(useSocketStore.getState().opponentRequestedRematch).toBe(true);
  });

  it('game:rematch_pending from self does not set opponentRequestedRematch', () => {
    mockSocket._trigger('game:rematch_pending', { from: 'self' });
    expect(useSocketStore.getState().opponentRequestedRematch).toBe(false);
  });

  it('chat:message appends message to chatMessages', () => {
    const msg = { id: '1', fromId: 'opp-id', fromUsername: 'PirateJoe', text: 'Ahoy!', timestamp: 1000 };
    useSocketStore.setState({ opponent: { id: 'other-id', username: 'Someone', rating: 1000, isReady: false } });
    mockSocket._trigger('chat:message', msg);
    expect(useSocketStore.getState().chatMessages).toHaveLength(1);
    expect(useSocketStore.getState().chatMessages[0]).toEqual(msg);
  });

  it('chat:message from muted opponent is filtered out', () => {
    useSocketStore.setState({
      mutedOpponent: true,
      opponent: { id: 'opp-id', username: 'PirateJoe', rating: 1200, isReady: false },
    });
    const msg = { id: '1', fromId: 'opp-id', fromUsername: 'PirateJoe', text: 'Surrender!', timestamp: 1000 };
    mockSocket._trigger('chat:message', msg);
    expect(useSocketStore.getState().chatMessages).toHaveLength(0);
  });

  it('chat messages are capped at 50', () => {
    for (let i = 0; i < 55; i++) {
      mockSocket._trigger('chat:message', { id: String(i), fromId: 'test-socket-id', fromUsername: 'me', text: `msg${i}`, timestamp: i });
    }
    const msgs = useSocketStore.getState().chatMessages;
    expect(msgs).toHaveLength(50);
    expect(msgs[49].text).toBe('msg54');
  });

  it('error event sets errorMessage with code and message', () => {
    mockSocket._trigger('error', { code: 'E001', message: 'Room full' });
    expect(useSocketStore.getState().errorMessage).toBe('E001: Room full');
  });
});

// ── Actions ──────────────────────────────────────────────────────────────────

describe('socketStore — actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket = makeSocket();
    mockIo.mockReturnValue(mockSocket);
    resetStore();
    useSocketStore.getState().connect('test-token');
  });

  it('joinMatchmaking emits mm:join and sets matchmakingState to queueing', () => {
    useSocketStore.getState().joinMatchmaking(['CannonBarrage', 'SonarPing'] as Parameters<typeof useSocketStore.getState.apply>[0] extends never ? never : never);
    expect(mockSocket.emit).toHaveBeenCalledWith('mm:join', { selectedAbilities: ['CannonBarrage', 'SonarPing'] });
    expect(useSocketStore.getState().matchmakingState).toBe('queueing');
  });

  it('joinMatchmaking does nothing when socket is null', () => {
    useSocketStore.setState({ socket: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSocketStore.getState().joinMatchmaking([] as any);
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('leaveMatchmaking emits mm:leave and sets matchmakingState to idle', () => {
    useSocketStore.setState({ matchmakingState: 'queueing' });
    useSocketStore.getState().leaveMatchmaking();
    expect(mockSocket.emit).toHaveBeenCalledWith('mm:leave');
    expect(useSocketStore.getState().matchmakingState).toBe('idle');
  });

  it('createPrivateRoom resolves with error when socket is null', async () => {
    useSocketStore.setState({ socket: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await useSocketStore.getState().createPrivateRoom([] as any);
    expect(result).toEqual({ error: 'Not connected' });
  });

  it('createPrivateRoom emits room:create and resolves with code on success', async () => {
    mockSocket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ code: 'XYZ9' });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await useSocketStore.getState().createPrivateRoom([] as any);
    expect(mockSocket.emit).toHaveBeenCalledWith('room:create', expect.anything(), expect.any(Function));
    expect(result).toEqual({ code: 'XYZ9' });
    expect(useSocketStore.getState().privateCode).toBe('XYZ9');
  });

  it('joinPrivateRoom resolves with error when socket is null', async () => {
    useSocketStore.setState({ socket: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await useSocketStore.getState().joinPrivateRoom('ABCD', [] as any);
    expect(result).toEqual({ error: 'Not connected' });
  });

  it('joinPrivateRoom emits room:join and resolves with server response', async () => {
    mockSocket.emit.mockImplementation((_event: string, _payload: unknown, ack: (res: unknown) => void) => {
      ack({ ok: true });
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await useSocketStore.getState().joinPrivateRoom('ABCD', [] as any);
    expect(mockSocket.emit).toHaveBeenCalledWith('room:join', expect.anything(), expect.any(Function));
    expect(result).toEqual({ ok: true });
  });

  it('submitPlacement emits game:place with placements', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSocketStore.getState().submitPlacement([{ shipType: 'Destroyer', positions: [] }] as any);
    expect(mockSocket.emit).toHaveBeenCalledWith('game:place', { placements: [{ shipType: 'Destroyer', positions: [] }] });
  });

  it('fire emits game:fire with coord', () => {
    useSocketStore.getState().fire({ row: 3, col: 5 });
    expect(mockSocket.emit).toHaveBeenCalledWith('game:fire', { coord: { row: 3, col: 5 } });
  });

  it('useAbility emits game:ability with ability and coord', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSocketStore.getState().useAbility('CannonBarrage' as any, { row: 0, col: 0 });
    expect(mockSocket.emit).toHaveBeenCalledWith('game:ability', { ability: 'CannonBarrage', coord: { row: 0, col: 0 } });
  });

  it('resign emits game:resign', () => {
    useSocketStore.getState().resign();
    expect(mockSocket.emit).toHaveBeenCalledWith('game:resign');
  });

  it('sendChat emits chat:message with text', () => {
    useSocketStore.getState().sendChat('Prepare to be boarded!');
    expect(mockSocket.emit).toHaveBeenCalledWith('chat:message', { text: 'Prepare to be boarded!' });
  });

  it('sendChat does nothing when socket is null', () => {
    useSocketStore.setState({ socket: null });
    useSocketStore.getState().sendChat('hello');
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('toggleMuteOpponent flips mutedOpponent', () => {
    expect(useSocketStore.getState().mutedOpponent).toBe(false);
    useSocketStore.getState().toggleMuteOpponent();
    expect(useSocketStore.getState().mutedOpponent).toBe(true);
    useSocketStore.getState().toggleMuteOpponent();
    expect(useSocketStore.getState().mutedOpponent).toBe(false);
  });

  it('requestRematch emits game:rematch_request and sets selfRequestedRematch', () => {
    useSocketStore.getState().requestRematch();
    expect(mockSocket.emit).toHaveBeenCalledWith('game:rematch_request');
    expect(useSocketStore.getState().selfRequestedRematch).toBe(true);
  });

  it('resetRoom clears all room and game state', () => {
    useSocketStore.setState({
      roomId: 'room-1',
      privateCode: 'CODE1',
      opponent: { id: 'opp', username: 'Blackbeard', rating: 1600, isReady: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gameState: { phase: 'playing' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matchSummary: { winnerId: 'me' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatMessages: [{ id: '1', fromId: 'x', fromUsername: 'x', text: 'hi', timestamp: 0 }] as any,
      opponentDisconnected: true,
      selfRequestedRematch: true,
      opponentRequestedRematch: true,
      matchmakingState: 'matched',
    });
    useSocketStore.getState().resetRoom();
    const s = useSocketStore.getState();
    expect(s.roomId).toBeNull();
    expect(s.privateCode).toBeNull();
    expect(s.opponent).toBeNull();
    expect(s.gameState).toBeNull();
    expect(s.matchSummary).toBeNull();
    expect(s.chatMessages).toEqual([]);
    expect(s.opponentDisconnected).toBe(false);
    expect(s.selfRequestedRematch).toBe(false);
    expect(s.opponentRequestedRematch).toBe(false);
    expect(s.matchmakingState).toBe('idle');
  });
});

// ── Disconnect state cleanup ─────────────────────────────────────────────────

describe('socketStore — disconnect state cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.clearAllTimers();
    mockSocket = makeSocket();
    mockIo.mockReturnValue(mockSocket);
    resetStore();
    useSocketStore.getState().connect('test-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disconnect() sets status to disconnected and nulls socket', () => {
    useSocketStore.getState().disconnect();
    const s = useSocketStore.getState();
    expect(s.status).toBe('disconnected');
    expect(s.socket).toBeNull();
  });

  it('disconnect() calls socket.disconnect()', () => {
    useSocketStore.getState().disconnect();
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('disconnect() resets all room and game state', () => {
    useSocketStore.setState({
      roomId: 'room-1',
      privateCode: 'ABC',
      opponent: { id: 'opp', username: 'Blackbeard', rating: 1600, isReady: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gameState: { phase: 'playing' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matchSummary: { winnerId: 'player1' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chatMessages: [{ id: '1', fromId: 'x', fromUsername: 'x', text: 'ahoy', timestamp: 0 }] as any,
      opponentDisconnected: true,
      selfRequestedRematch: true,
      opponentRequestedRematch: true,
    });
    useSocketStore.getState().disconnect();
    const s = useSocketStore.getState();
    expect(s.roomId).toBeNull();
    expect(s.privateCode).toBeNull();
    expect(s.opponent).toBeNull();
    expect(s.gameState).toBeNull();
    expect(s.matchSummary).toBeNull();
    expect(s.chatMessages).toEqual([]);
    expect(s.opponentDisconnected).toBe(false);
    expect(s.selfRequestedRematch).toBe(false);
    expect(s.opponentRequestedRematch).toBe(false);
    expect(s.matchmakingState).toBe('idle');
  });
});
