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
    data: unknown;
    constructor(message: string, status = 400, data?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  },
}));

import { useSeasonsStore } from '../store/seasonsStore';
import { apiFetchSafe } from '../services/apiClient';
import type { SeasonInfo } from '@shared/index';

const mockApiFetchSafe = apiFetchSafe as ReturnType<typeof vi.fn>;

const ACTIVE_SEASON: SeasonInfo = {
  id: 'season-1',
  name: 'Season 1',
  startAt: '2026-01-01T00:00:00.000Z',
  endAt: '2026-02-01T00:00:00.000Z',
  isActive: true,
};

const PAST_SEASON: SeasonInfo = {
  id: 'season-0',
  name: 'Season 0',
  startAt: '2025-12-01T00:00:00.000Z',
  endAt: '2025-12-31T00:00:00.000Z',
  isActive: false,
};

describe('seasonsStore', () => {
  beforeEach(() => {
    useSeasonsStore.setState({
      activeSeason: null,
      allSeasons: [],
      selectedSeasonId: 'active',
      loading: false,
    });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useSeasonsStore.getState();
    expect(state.activeSeason).toBeNull();
    expect(state.allSeasons).toEqual([]);
    expect(state.selectedSeasonId).toBe('active');
    expect(state.loading).toBe(false);
  });

  describe('fetchActive', () => {
    it('populates activeSeason when server returns a season', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ season: ACTIVE_SEASON });

      await useSeasonsStore.getState().fetchActive();

      expect(useSeasonsStore.getState().activeSeason).toEqual(ACTIVE_SEASON);
    });

    it('sets activeSeason to null when server returns season: null', async () => {
      useSeasonsStore.setState({ activeSeason: ACTIVE_SEASON });
      mockApiFetchSafe.mockResolvedValueOnce({ season: null });

      await useSeasonsStore.getState().fetchActive();

      expect(useSeasonsStore.getState().activeSeason).toBeNull();
    });

    it('sets activeSeason to null when server response has no season field', async () => {
      useSeasonsStore.setState({ activeSeason: ACTIVE_SEASON });
      mockApiFetchSafe.mockResolvedValueOnce({});

      await useSeasonsStore.getState().fetchActive();

      expect(useSeasonsStore.getState().activeSeason).toBeNull();
    });

    it('does not update state when server returns null (network error)', async () => {
      useSeasonsStore.setState({ activeSeason: ACTIVE_SEASON });
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useSeasonsStore.getState().fetchActive();

      // State should be unchanged when apiFetchSafe returns null
      expect(useSeasonsStore.getState().activeSeason).toEqual(ACTIVE_SEASON);
    });

    it('calls the correct endpoint', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ season: ACTIVE_SEASON });

      await useSeasonsStore.getState().fetchActive();

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/seasons/active');
    });
  });

  describe('fetchAll', () => {
    it('populates allSeasons from server response', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ seasons: [ACTIVE_SEASON, PAST_SEASON] });

      await useSeasonsStore.getState().fetchAll();

      expect(useSeasonsStore.getState().allSeasons).toEqual([ACTIVE_SEASON, PAST_SEASON]);
    });

    it('sets allSeasons to empty array when server returns seasons: []', async () => {
      useSeasonsStore.setState({ allSeasons: [ACTIVE_SEASON] });
      mockApiFetchSafe.mockResolvedValueOnce({ seasons: [] });

      await useSeasonsStore.getState().fetchAll();

      expect(useSeasonsStore.getState().allSeasons).toEqual([]);
    });

    it('sets allSeasons to empty array when server response has no seasons field', async () => {
      useSeasonsStore.setState({ allSeasons: [ACTIVE_SEASON] });
      mockApiFetchSafe.mockResolvedValueOnce({});

      await useSeasonsStore.getState().fetchAll();

      expect(useSeasonsStore.getState().allSeasons).toEqual([]);
    });

    it('does not update allSeasons when server returns null', async () => {
      useSeasonsStore.setState({ allSeasons: [ACTIVE_SEASON] });
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useSeasonsStore.getState().fetchAll();

      expect(useSeasonsStore.getState().allSeasons).toEqual([ACTIVE_SEASON]);
    });

    it('sets loading true while fetching and false after', async () => {
      let resolvePromise!: (value: unknown) => void;
      const pendingPromise = new Promise((res) => { resolvePromise = res; });
      mockApiFetchSafe.mockReturnValueOnce(pendingPromise);

      const fetchPromise = useSeasonsStore.getState().fetchAll();
      expect(useSeasonsStore.getState().loading).toBe(true);

      resolvePromise({ seasons: [ACTIVE_SEASON] });
      await fetchPromise;
      expect(useSeasonsStore.getState().loading).toBe(false);
    });

    it('clears loading even when server returns null', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useSeasonsStore.getState().fetchAll();

      expect(useSeasonsStore.getState().loading).toBe(false);
    });

    it('calls the correct endpoint', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ seasons: [] });

      await useSeasonsStore.getState().fetchAll();

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/seasons');
    });
  });

  describe('selectSeason', () => {
    it('updates selectedSeasonId to the given value', () => {
      useSeasonsStore.getState().selectSeason('season-1');
      expect(useSeasonsStore.getState().selectedSeasonId).toBe('season-1');
    });

    it('allows selecting "lifetime"', () => {
      useSeasonsStore.getState().selectSeason('lifetime');
      expect(useSeasonsStore.getState().selectedSeasonId).toBe('lifetime');
    });

    it('allows selecting "active"', () => {
      useSeasonsStore.setState({ selectedSeasonId: 'lifetime' });
      useSeasonsStore.getState().selectSeason('active');
      expect(useSeasonsStore.getState().selectedSeasonId).toBe('active');
    });

    it('allows selecting a specific season ID', () => {
      useSeasonsStore.getState().selectSeason('season-0');
      expect(useSeasonsStore.getState().selectedSeasonId).toBe('season-0');
    });
  });
});
