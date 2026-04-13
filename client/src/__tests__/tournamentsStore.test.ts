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

import { useTournamentsStore } from '../store/tournamentsStore';
import { apiFetch, apiFetchSafe } from '../services/apiClient';
import type { TournamentSummary, TournamentDetail } from '@shared/index';

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
const mockApiFetchSafe = apiFetchSafe as ReturnType<typeof vi.fn>;

function makeSummary(overrides: Partial<TournamentSummary> = {}): TournamentSummary {
  return {
    id: 't1',
    name: 'Test Cup',
    status: 'lobby',
    maxPlayers: 8,
    playerCount: 2,
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeDetail(overrides: Partial<TournamentDetail> = {}): TournamentDetail {
  return {
    ...makeSummary(),
    entries: [
      { userId: 'user-1', username: 'Alice', seed: 1, eliminated: false },
      { userId: 'user-2', username: 'Bob', seed: 2, eliminated: false },
    ],
    matches: [],
    ...overrides,
  };
}

function resetStore() {
  useTournamentsStore.setState({
    list: [],
    current: null,
    loading: false,
    error: null,
  });
}

describe('tournamentsStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  it('has correct initial state', () => {
    const state = useTournamentsStore.getState();
    expect(state.list).toEqual([]);
    expect(state.current).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  // ── fetchList ──────────────────────────────────────────────────────────────

  describe('fetchList', () => {
    it('sets list from server response', async () => {
      const summaries = [makeSummary({ id: 't1' }), makeSummary({ id: 't2', name: 'Grand Prix' })];
      mockApiFetchSafe.mockResolvedValueOnce({ tournaments: summaries });

      await useTournamentsStore.getState().fetchList();

      const state = useTournamentsStore.getState();
      expect(state.list).toEqual(summaries);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('defaults to empty list when tournaments field is missing', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({});

      await useTournamentsStore.getState().fetchList();

      expect(useTournamentsStore.getState().list).toEqual([]);
    });

    it('sets error when server returns null (offline)', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useTournamentsStore.getState().fetchList();

      const state = useTournamentsStore.getState();
      expect(state.list).toEqual([]);
      expect(state.error).toBe('Tournaments unavailable offline');
      expect(state.loading).toBe(false);
    });

    it('sets loading true during fetch then clears it', async () => {
      let loadingDuring = false;
      mockApiFetchSafe.mockImplementationOnce(async () => {
        loadingDuring = useTournamentsStore.getState().loading;
        return { tournaments: [] };
      });

      await useTournamentsStore.getState().fetchList();

      expect(loadingDuring).toBe(true);
      expect(useTournamentsStore.getState().loading).toBe(false);
    });

    it('clears previous error on new fetch', async () => {
      useTournamentsStore.setState({ error: 'old error' });
      mockApiFetchSafe.mockResolvedValueOnce({ tournaments: [] });

      await useTournamentsStore.getState().fetchList();

      expect(useTournamentsStore.getState().error).toBeNull();
    });
  });

  // ── fetchOne ───────────────────────────────────────────────────────────────

  describe('fetchOne', () => {
    it('sets current from server response', async () => {
      const detail = makeDetail({ id: 't1' });
      mockApiFetchSafe.mockResolvedValueOnce({ tournament: detail });

      await useTournamentsStore.getState().fetchOne('t1');

      const state = useTournamentsStore.getState();
      expect(state.current).toEqual(detail);
      expect(state.loading).toBe(false);
    });

    it('sets current to null when tournament field is missing', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ tournament: null });

      await useTournamentsStore.getState().fetchOne('t1');

      expect(useTournamentsStore.getState().current).toBeNull();
    });

    it('sets error when server returns null (offline)', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useTournamentsStore.getState().fetchOne('bad-id');

      const state = useTournamentsStore.getState();
      expect(state.error).toBe('Tournament not found');
      expect(state.loading).toBe(false);
    });

    it('sets loading true during fetch then clears it', async () => {
      let loadingDuring = false;
      mockApiFetchSafe.mockImplementationOnce(async () => {
        loadingDuring = useTournamentsStore.getState().loading;
        return { tournament: makeDetail() };
      });

      await useTournamentsStore.getState().fetchOne('t1');

      expect(loadingDuring).toBe(true);
      expect(useTournamentsStore.getState().loading).toBe(false);
    });

    it('calls correct endpoint', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ tournament: makeDetail() });

      await useTournamentsStore.getState().fetchOne('tournament-99');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/tournaments/tournament-99');
    });
  });

  // ── create ─────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('returns id and refreshes list on success', async () => {
      mockApiFetch.mockResolvedValueOnce({ id: 'new-t' });
      mockApiFetchSafe.mockResolvedValueOnce({ tournaments: [makeSummary({ id: 'new-t', name: 'New Cup' })] });

      const result = await useTournamentsStore.getState().create('New Cup', 8, 'tok');

      expect(result).toEqual({ id: 'new-t' });
      expect(useTournamentsStore.getState().list).toHaveLength(1);
      expect(useTournamentsStore.getState().list[0].id).toBe('new-t');
    });

    it('calls correct endpoint with correct payload', async () => {
      mockApiFetch.mockResolvedValueOnce({ id: 'new-t' });
      mockApiFetchSafe.mockResolvedValueOnce({ tournaments: [] });

      await useTournamentsStore.getState().create('Battle Cup', 16, 'mytoken');

      expect(mockApiFetch).toHaveBeenCalledWith('/tournaments', expect.objectContaining({
        method: 'POST',
        token: 'mytoken',
        json: { name: 'Battle Cup', maxPlayers: 16 },
      }));
    });

    it('returns error when ApiError is thrown', async () => {
      const { ApiError } = await import('../services/apiClient');
      mockApiFetch.mockRejectedValueOnce(new ApiError('Name taken', 400, undefined));

      const result = await useTournamentsStore.getState().create('Taken', 8, 'tok');

      expect(result).toEqual({ error: 'Name taken' });
    });

    it('returns offline error for non-ApiError exceptions', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await useTournamentsStore.getState().create('Cup', 8, 'tok');

      expect(result).toEqual({ error: 'Tournaments unavailable offline' });
    });
  });

  // ── join ───────────────────────────────────────────────────────────────────

  describe('join', () => {
    it('returns ok and refreshes current on success', async () => {
      const detail = makeDetail({ id: 't1', playerCount: 3 });
      mockApiFetch.mockResolvedValueOnce({});
      mockApiFetchSafe.mockResolvedValueOnce({ tournament: detail });

      const result = await useTournamentsStore.getState().join('t1', 'tok');

      expect(result).toEqual({ ok: true });
      expect(useTournamentsStore.getState().current).toEqual(detail);
    });

    it('calls correct join endpoint', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      mockApiFetchSafe.mockResolvedValueOnce({ tournament: makeDetail() });

      await useTournamentsStore.getState().join('t99', 'mytoken');

      expect(mockApiFetch).toHaveBeenCalledWith('/tournaments/t99/join', expect.objectContaining({
        method: 'POST',
        token: 'mytoken',
      }));
    });

    it('returns error when ApiError is thrown', async () => {
      const { ApiError } = await import('../services/apiClient');
      mockApiFetch.mockRejectedValueOnce(new ApiError('Tournament full', 409, undefined));

      const result = await useTournamentsStore.getState().join('t1', 'tok');

      expect(result).toEqual({ error: 'Tournament full' });
    });

    it('returns offline error for non-ApiError exceptions', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await useTournamentsStore.getState().join('t1', 'tok');

      expect(result).toEqual({ error: 'Tournaments unavailable offline' });
    });
  });

  // ── bracket state management ───────────────────────────────────────────────

  describe('bracket state', () => {
    it('fetchOne populates matches and entries', async () => {
      const detail = makeDetail({
        id: 't1',
        status: 'active',
        matches: [
          {
            id: 'm1',
            round: 0,
            bracketIdx: 0,
            p1UserId: 'user-1',
            p2UserId: 'user-2',
            winnerUserId: null,
            status: 'in_progress',
          },
        ],
        entries: [
          { userId: 'user-1', username: 'Alice', seed: 1, eliminated: false },
          { userId: 'user-2', username: 'Bob', seed: 2, eliminated: false },
        ],
      });
      mockApiFetchSafe.mockResolvedValueOnce({ tournament: detail });

      await useTournamentsStore.getState().fetchOne('t1');

      const current = useTournamentsStore.getState().current!;
      expect(current.matches).toHaveLength(1);
      expect(current.matches[0].status).toBe('in_progress');
      expect(current.entries).toHaveLength(2);
    });

    it('fetchOne handles finished tournament with winner', async () => {
      const detail = makeDetail({
        id: 't1',
        status: 'finished',
        winnerId: 'user-1',
        finishedAt: '2026-01-02T00:00:00Z',
      });
      mockApiFetchSafe.mockResolvedValueOnce({ tournament: detail });

      await useTournamentsStore.getState().fetchOne('t1');

      const current = useTournamentsStore.getState().current!;
      expect(current.status).toBe('finished');
      expect(current.winnerId).toBe('user-1');
    });
  });

  // ── status transitions ─────────────────────────────────────────────────────

  describe('status transitions', () => {
    it('list can contain tournaments in various statuses', async () => {
      const summaries = [
        makeSummary({ id: 't1', status: 'lobby' }),
        makeSummary({ id: 't2', status: 'active' }),
        makeSummary({ id: 't3', status: 'finished' }),
        makeSummary({ id: 't4', status: 'cancelled' }),
      ];
      mockApiFetchSafe.mockResolvedValueOnce({ tournaments: summaries });

      await useTournamentsStore.getState().fetchList();

      const list = useTournamentsStore.getState().list;
      expect(list).toHaveLength(4);
      expect(list.map((t) => t.status)).toEqual(['lobby', 'active', 'finished', 'cancelled']);
    });

    it('fetchList replaces stale list with fresh data', async () => {
      useTournamentsStore.setState({ list: [makeSummary({ id: 'old' })] });
      mockApiFetchSafe.mockResolvedValueOnce({ tournaments: [makeSummary({ id: 'new' })] });

      await useTournamentsStore.getState().fetchList();

      const list = useTournamentsStore.getState().list;
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('new');
    });
  });
});
