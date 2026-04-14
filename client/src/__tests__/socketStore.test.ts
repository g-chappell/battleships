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
