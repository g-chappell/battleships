import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock audio service before importing the store
vi.mock('../services/audio', () => ({
  setVolume: vi.fn(),
  setMuted: vi.fn(),
  setSfxVolume: vi.fn(),
  setMusicVolume: vi.fn(),
  startAmbientLoop: vi.fn(),
  stopAmbientLoop: vi.fn(),
}));

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  apiFetch: vi.fn(),
  apiFetchSafe: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
    }
  },
}));

import { useReplayStore } from '../store/replayStore';
import { apiFetchSafe } from '../services/apiClient';
import { CellState, ShipType, Orientation } from '@shared/index';
import type { ReplayData, ReplayEvent } from '@shared/index';

const mockApiFetchSafe = apiFetchSafe as ReturnType<typeof vi.fn>;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReplayData(events: ReplayEvent[] = []): ReplayData {
  return {
    version: 1,
    matchId: 'match-1',
    p1: { id: 'user-1', username: 'Alice' },
    p2: { id: 'user-2', username: 'Bob' },
    mode: 'ranked',
    startedAt: 1700000000000,
    events,
  };
}

function makePlacementEvent(side: 'p1' | 'p2', t = 0): ReplayEvent {
  return {
    t,
    kind: 'placement',
    side,
    placements: [
      { type: ShipType.Destroyer, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
    ],
  };
}

function makeFireEvent(
  side: 'p1' | 'p2',
  row: number,
  col: number,
  result: 'hit' | 'miss' | 'sink',
  t = 1
): ReplayEvent {
  return {
    t,
    kind: 'fire',
    side,
    coord: { row, col },
    outcome: { result: result as never, coordinate: { row, col } },
  };
}

function resetStore() {
  useReplayStore.setState({
    replay: null,
    cursor: 0,
    playing: false,
    speed: 1,
    p1Board: {
      width: 10,
      height: 10,
      cells: Array.from({ length: 10 }, () => Array(10).fill(CellState.Empty)),
    },
    p2Board: {
      width: 10,
      height: 10,
      cells: Array.from({ length: 10 }, () => Array(10).fill(CellState.Empty)),
    },
    loading: false,
    error: null,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('replayStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    // Ensure playback is stopped after each test
    useReplayStore.getState().pause();
  });

  // ── Initial state ────────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('has correct initial state', () => {
      const state = useReplayStore.getState();
      expect(state.replay).toBeNull();
      expect(state.cursor).toBe(0);
      expect(state.playing).toBe(false);
      expect(state.speed).toBe(1);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('initializes boards as 10x10 empty grids', () => {
      const { p1Board, p2Board } = useReplayStore.getState();
      expect(p1Board.width).toBe(10);
      expect(p1Board.height).toBe(10);
      expect(p1Board.cells).toHaveLength(10);
      expect(p1Board.cells[0]).toHaveLength(10);
      expect(p1Board.cells[0][0]).toBe(CellState.Empty);
      expect(p2Board.width).toBe(10);
      expect(p2Board.height).toBe(10);
    });
  });

  // ── load — localStorage path ─────────────────────────────────────────────────

  describe('load — localStorage', () => {
    it('loads replay from localStorage when present', async () => {
      const replay = makeReplayData();
      localStorage.setItem('battleships_replay_match-1', JSON.stringify(replay));

      await useReplayStore.getState().load('match-1');

      const state = useReplayStore.getState();
      expect(state.replay).toEqual(replay);
      expect(state.cursor).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      // API should not be called when localStorage has data
      expect(mockApiFetchSafe).not.toHaveBeenCalled();
    });

    it('resets boards to empty when loading from localStorage', async () => {
      // Pre-dirty the board
      useReplayStore.setState({
        p1Board: {
          width: 10,
          height: 10,
          cells: Array.from({ length: 10 }, (_, r) =>
            Array.from({ length: 10 }, (_, c) => (r === 0 && c === 0 ? CellState.Hit : CellState.Empty))
          ),
        },
      });

      const replay = makeReplayData();
      localStorage.setItem('battleships_replay_match-2', JSON.stringify(replay));

      await useReplayStore.getState().load('match-2');

      const { p1Board } = useReplayStore.getState();
      expect(p1Board.cells[0][0]).toBe(CellState.Empty);
    });

    it('falls through to API when localStorage key is absent', async () => {
      const replay = makeReplayData();
      mockApiFetchSafe.mockResolvedValueOnce({ replay });

      await useReplayStore.getState().load('match-99');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/matches/match-99/replay');
      expect(useReplayStore.getState().replay).toEqual(replay);
    });
  });

  // ── load — API path ──────────────────────────────────────────────────────────

  describe('load — API', () => {
    it('loads replay from API and sets it in state', async () => {
      const replay = makeReplayData([makePlacementEvent('p1')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });

      await useReplayStore.getState().load('match-1');

      const state = useReplayStore.getState();
      expect(state.replay).toEqual(replay);
      expect(state.cursor).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('calls correct API endpoint', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ replay: makeReplayData() });

      await useReplayStore.getState().load('match-abc');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/matches/match-abc/replay');
    });

    it('sets error when API returns null', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useReplayStore.getState().load('missing');

      const state = useReplayStore.getState();
      expect(state.replay).toBeNull();
      expect(state.error).toBe('Replay not found');
      expect(state.loading).toBe(false);
    });

    it('sets loading true during fetch then clears it', async () => {
      let loadingDuring = false;
      mockApiFetchSafe.mockImplementationOnce(async () => {
        loadingDuring = useReplayStore.getState().loading;
        return { replay: makeReplayData() };
      });

      await useReplayStore.getState().load('match-1');

      expect(loadingDuring).toBe(true);
      expect(useReplayStore.getState().loading).toBe(false);
    });

    it('resets boards when loading via API', async () => {
      useReplayStore.setState({
        p1Board: {
          width: 10,
          height: 10,
          cells: Array.from({ length: 10 }, (_, r) =>
            Array.from({ length: 10 }, (_, c) => (r === 5 && c === 5 ? CellState.Hit : CellState.Empty))
          ),
        },
      });

      mockApiFetchSafe.mockResolvedValueOnce({ replay: makeReplayData() });

      await useReplayStore.getState().load('match-1');

      expect(useReplayStore.getState().p1Board.cells[5][5]).toBe(CellState.Empty);
    });
  });

  // ── seek ─────────────────────────────────────────────────────────────────────

  describe('seek', () => {
    it('does nothing when no replay is loaded', () => {
      useReplayStore.getState().seek(5);
      expect(useReplayStore.getState().cursor).toBe(0);
    });

    it('moves cursor to specified index', async () => {
      const replay = makeReplayData([
        makePlacementEvent('p1', 0),
        makePlacementEvent('p2', 1),
        makeFireEvent('p1', 3, 3, 'miss', 2),
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(2);

      expect(useReplayStore.getState().cursor).toBe(2);
    });

    it('clamps seek to 0 when index is negative', async () => {
      const replay = makeReplayData([makePlacementEvent('p1')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(-5);

      expect(useReplayStore.getState().cursor).toBe(0);
    });

    it('clamps seek to events.length when index exceeds event count', async () => {
      const replay = makeReplayData([makePlacementEvent('p1'), makePlacementEvent('p2')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(999);

      expect(useReplayStore.getState().cursor).toBe(2);
    });

    it('applies placement events to the correct board', async () => {
      const replay = makeReplayData([
        // Destroyer horizontal at (0,0): occupies (0,0) and (0,1)
        makePlacementEvent('p1', 0),
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(1);

      const { p1Board, p2Board } = useReplayStore.getState();
      expect(p1Board.cells[0][0]).toBe(CellState.Ship);
      expect(p1Board.cells[0][1]).toBe(CellState.Ship);
      expect(p2Board.cells[0][0]).toBe(CellState.Empty);
    });

    it('applies fire hit events to the OPPOSITE board', async () => {
      const replay = makeReplayData([
        // p1 fires at (5, 7) — hit lands on p2 board
        makeFireEvent('p1', 5, 7, 'hit', 0),
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(1);

      const { p1Board, p2Board } = useReplayStore.getState();
      expect(p2Board.cells[5][7]).toBe(CellState.Hit);
      expect(p1Board.cells[5][7]).toBe(CellState.Empty);
    });

    it('applies fire miss events as Miss state on opposite board', async () => {
      const replay = makeReplayData([makeFireEvent('p2', 3, 4, 'miss', 0)]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(1);

      // p2 fires → lands on p1 board
      const { p1Board } = useReplayStore.getState();
      expect(p1Board.cells[3][4]).toBe(CellState.Miss);
    });

    it('treats sink result as Hit state on opposite board', async () => {
      const replay = makeReplayData([makeFireEvent('p1', 0, 0, 'sink', 0)]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(1);

      expect(useReplayStore.getState().p2Board.cells[0][0]).toBe(CellState.Hit);
    });

    it('rebuilds board from scratch (not incrementally) on each seek', async () => {
      const replay = makeReplayData([
        makeFireEvent('p1', 2, 2, 'hit', 0),
        makeFireEvent('p1', 3, 3, 'miss', 1),
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      // Seek to 2 then back to 1 — board should reflect only first event
      useReplayStore.getState().seek(2);
      useReplayStore.getState().seek(1);

      const { p2Board } = useReplayStore.getState();
      expect(p2Board.cells[2][2]).toBe(CellState.Hit);
      expect(p2Board.cells[3][3]).toBe(CellState.Empty);
    });

    it('handles vertical ship placement correctly', async () => {
      const replay = makeReplayData([
        {
          t: 0,
          kind: 'placement',
          side: 'p2',
          placements: [
            { type: ShipType.Destroyer, start: { row: 2, col: 5 }, orientation: Orientation.Vertical },
          ],
        },
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(1);

      // Destroyer length=2, vertical: (2,5) and (3,5)
      const { p2Board } = useReplayStore.getState();
      expect(p2Board.cells[2][5]).toBe(CellState.Ship);
      expect(p2Board.cells[3][5]).toBe(CellState.Ship);
      expect(p2Board.cells[4][5]).toBe(CellState.Empty);
    });

    it('handles carrier placement (length 5)', async () => {
      const replay = makeReplayData([
        {
          t: 0,
          kind: 'placement',
          side: 'p1',
          placements: [
            { type: ShipType.Carrier, start: { row: 0, col: 0 }, orientation: Orientation.Horizontal },
          ],
        },
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(1);

      const { p1Board } = useReplayStore.getState();
      for (let c = 0; c < 5; c++) {
        expect(p1Board.cells[0][c]).toBe(CellState.Ship);
      }
      expect(p1Board.cells[0][5]).toBe(CellState.Empty);
    });
  });

  // ── play ─────────────────────────────────────────────────────────────────────

  describe('play', () => {
    it('does nothing when no replay is loaded', () => {
      useReplayStore.getState().play();
      expect(useReplayStore.getState().playing).toBe(false);
    });

    it('sets playing to true', async () => {
      const replay = makeReplayData([makePlacementEvent('p1')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play();

      expect(useReplayStore.getState().playing).toBe(true);
    });

    it('advances cursor on each interval tick', async () => {
      const replay = makeReplayData([
        makePlacementEvent('p1', 0),
        makePlacementEvent('p2', 1),
        makeFireEvent('p1', 0, 0, 'miss', 2),
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play();
      expect(useReplayStore.getState().cursor).toBe(0);

      // Default speed=1: interval = 800ms
      vi.advanceTimersByTime(800);
      expect(useReplayStore.getState().cursor).toBe(1);

      vi.advanceTimersByTime(800);
      expect(useReplayStore.getState().cursor).toBe(2);
    });

    it('stops playing and sets playing=false when reaching end of events', async () => {
      const replay = makeReplayData([makePlacementEvent('p1', 0)]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play();
      vi.advanceTimersByTime(800); // advances cursor to 1 (= events.length)
      vi.advanceTimersByTime(800); // triggers the stop check

      const state = useReplayStore.getState();
      expect(state.playing).toBe(false);
    });

    it('uses speed setting to adjust interval (speed=2 → 400ms)', async () => {
      const replay = makeReplayData([makePlacementEvent('p1', 0), makePlacementEvent('p2', 1)]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.setState({ speed: 2 });
      useReplayStore.getState().play();

      vi.advanceTimersByTime(400);
      expect(useReplayStore.getState().cursor).toBe(1);
    });
  });

  // ── pause ────────────────────────────────────────────────────────────────────

  describe('pause', () => {
    it('sets playing to false', async () => {
      const replay = makeReplayData([makePlacementEvent('p1')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play();
      useReplayStore.getState().pause();

      expect(useReplayStore.getState().playing).toBe(false);
    });

    it('stops cursor advancement after pause', async () => {
      const replay = makeReplayData([
        makePlacementEvent('p1', 0),
        makePlacementEvent('p2', 1),
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play();
      vi.advanceTimersByTime(800); // cursor → 1
      useReplayStore.getState().pause();
      vi.advanceTimersByTime(800); // no more ticks

      expect(useReplayStore.getState().cursor).toBe(1);
    });

    it('pause on already-paused store does not throw', () => {
      expect(() => useReplayStore.getState().pause()).not.toThrow();
    });
  });

  // ── setSpeed ─────────────────────────────────────────────────────────────────

  describe('setSpeed', () => {
    it('updates speed state', () => {
      useReplayStore.getState().setSpeed(4);
      expect(useReplayStore.getState().speed).toBe(4);
    });

    it('restarts playback when currently playing (speed=4 → 200ms interval)', async () => {
      const replay = makeReplayData([
        makePlacementEvent('p1', 0),
        makePlacementEvent('p2', 1),
        makeFireEvent('p1', 0, 0, 'miss', 2),
      ]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play(); // speed=1 → 800ms interval

      useReplayStore.getState().setSpeed(4); // restart with 200ms interval
      vi.advanceTimersByTime(200);
      expect(useReplayStore.getState().cursor).toBe(1);
    });

    it('does not start playback if currently paused', async () => {
      const replay = makeReplayData([makePlacementEvent('p1')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().setSpeed(2);
      vi.advanceTimersByTime(1000);

      expect(useReplayStore.getState().playing).toBe(false);
      expect(useReplayStore.getState().cursor).toBe(0);
    });
  });

  // ── reset ────────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('clears replay data and resets cursor', async () => {
      const replay = makeReplayData([makePlacementEvent('p1')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');
      useReplayStore.getState().seek(1);

      useReplayStore.getState().reset();

      const state = useReplayStore.getState();
      expect(state.replay).toBeNull();
      expect(state.cursor).toBe(0);
    });

    it('stops playback on reset', async () => {
      const replay = makeReplayData([makePlacementEvent('p1')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play();
      useReplayStore.getState().reset();

      expect(useReplayStore.getState().playing).toBe(false);
    });

    it('resets boards to empty after reset', async () => {
      const replay = makeReplayData([makeFireEvent('p1', 3, 3, 'hit')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');
      useReplayStore.getState().seek(1);

      useReplayStore.getState().reset();

      const { p1Board, p2Board } = useReplayStore.getState();
      expect(p1Board.cells[3][3]).toBe(CellState.Empty);
      expect(p2Board.cells[3][3]).toBe(CellState.Empty);
    });

    it('clears error state on reset', async () => {
      useReplayStore.setState({ error: 'Replay not found' });

      useReplayStore.getState().reset();

      expect(useReplayStore.getState().error).toBeNull();
    });

    it('cursor stays stopped after reset even if timers advance', async () => {
      const replay = makeReplayData([makePlacementEvent('p1'), makePlacementEvent('p2')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().play();
      useReplayStore.getState().reset();
      vi.advanceTimersByTime(2000);

      expect(useReplayStore.getState().cursor).toBe(0);
    });
  });

  // ── edge cases ───────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('seek to 0 produces empty boards regardless of events', async () => {
      const replay = makeReplayData([makeFireEvent('p1', 5, 5, 'hit')]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      useReplayStore.getState().seek(1);
      useReplayStore.getState().seek(0);

      const { p1Board, p2Board } = useReplayStore.getState();
      expect(p1Board.cells[5][5]).toBe(CellState.Empty);
      expect(p2Board.cells[5][5]).toBe(CellState.Empty);
    });

    it('handles empty event list gracefully', async () => {
      const replay = makeReplayData([]);
      mockApiFetchSafe.mockResolvedValueOnce({ replay });
      await useReplayStore.getState().load('match-1');

      expect(() => useReplayStore.getState().seek(0)).not.toThrow();
      expect(useReplayStore.getState().cursor).toBe(0);
    });

    it('new load while playing stops previous interval', async () => {
      const replay1 = makeReplayData([makePlacementEvent('p1'), makePlacementEvent('p2')]);
      const replay2 = makeReplayData([makeFireEvent('p1', 0, 0, 'miss')]);

      mockApiFetchSafe.mockResolvedValueOnce({ replay: replay1 });
      await useReplayStore.getState().load('match-1');
      useReplayStore.getState().play();

      mockApiFetchSafe.mockResolvedValueOnce({ replay: replay2 });
      await useReplayStore.getState().load('match-2');

      // Advance time — cursor should NOT advance since old interval was cleared
      vi.advanceTimersByTime(800);
      expect(useReplayStore.getState().cursor).toBe(0);
    });
  });
});
