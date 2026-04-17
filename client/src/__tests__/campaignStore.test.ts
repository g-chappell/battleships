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

import { useCampaignStore } from '../store/campaignStore';
import { apiFetch, apiFetchSafe } from '../services/apiClient';

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
const mockApiFetchSafe = apiFetchSafe as ReturnType<typeof vi.fn>;

const STORAGE_KEY = 'battleships_campaign_progress';

function resetStore() {
  useCampaignStore.setState({
    progress: {},
    highestUnlocked: 1,
    currentMission: null,
    showBriefing: false,
    showOutro: false,
    lastResult: null,
  });
}

describe('campaignStore', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useCampaignStore.getState();
    expect(state.progress).toEqual({});
    expect(state.highestUnlocked).toBe(1);
    expect(state.currentMission).toBeNull();
    expect(state.showBriefing).toBe(false);
    expect(state.showOutro).toBe(false);
    expect(state.lastResult).toBeNull();
  });

  describe('loadProgress', () => {
    it('loads progress from server when token and userId provided', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({
        progress: {
          missionStars: { 1: { stars: 3, bestTurns: 20 }, 2: { stars: 2, bestTurns: 28 } },
          highestUnlocked: 3,
        },
      });

      await useCampaignStore.getState().loadProgress('token123', 'user456');

      const state = useCampaignStore.getState();
      expect(state.progress[1]).toEqual({ stars: 3, bestTurns: 20 });
      expect(state.progress[2]).toEqual({ stars: 2, bestTurns: 28 });
      expect(state.highestUnlocked).toBe(3);
      expect(mockApiFetchSafe).toHaveBeenCalledWith('/campaign/user456', { token: 'token123' });
    });

    it('falls back to localStorage when server returns no progress', async () => {
      const saved = { progress: { 1: { stars: 2, bestTurns: 30 } }, highestUnlocked: 2 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      mockApiFetchSafe.mockResolvedValueOnce({ progress: null });

      await useCampaignStore.getState().loadProgress('token123', 'user456');

      const state = useCampaignStore.getState();
      expect(state.progress[1]).toEqual({ stars: 2, bestTurns: 30 });
      expect(state.highestUnlocked).toBe(2);
    });

    it('falls back to localStorage when no token provided', async () => {
      const saved = { progress: { 1: { stars: 1, bestTurns: 40 } }, highestUnlocked: 2 };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      await useCampaignStore.getState().loadProgress();

      const state = useCampaignStore.getState();
      expect(state.progress[1]).toEqual({ stars: 1, bestTurns: 40 });
      expect(state.highestUnlocked).toBe(2);
      expect(mockApiFetchSafe).not.toHaveBeenCalled();
    });

    it('does nothing when localStorage is empty and no token', async () => {
      await useCampaignStore.getState().loadProgress();
      const state = useCampaignStore.getState();
      expect(state.progress).toEqual({});
      expect(state.highestUnlocked).toBe(1);
    });

    it('uses defaults for missing localStorage fields', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
      await useCampaignStore.getState().loadProgress();
      const state = useCampaignStore.getState();
      expect(state.progress).toEqual({});
      expect(state.highestUnlocked).toBe(1);
    });
  });

  describe('saveProgressLocal', () => {
    it('saves progress and highestUnlocked to localStorage', () => {
      useCampaignStore.setState({
        progress: { 1: { stars: 3, bestTurns: 22 } },
        highestUnlocked: 2,
      });

      useCampaignStore.getState().saveProgressLocal();

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.progress[1]).toEqual({ stars: 3, bestTurns: 22 });
      expect(stored.highestUnlocked).toBe(2);
    });
  });

  describe('setCurrentMission', () => {
    it('sets currentMission by ID', () => {
      useCampaignStore.getState().setCurrentMission(1);
      const state = useCampaignStore.getState();
      expect(state.currentMission).not.toBeNull();
      expect(state.currentMission?.id).toBe(1);
      expect(state.currentMission?.title).toBe('Blood at Dawn');
    });

    it('does nothing for invalid mission ID', () => {
      useCampaignStore.getState().setCurrentMission(999);
      expect(useCampaignStore.getState().currentMission).toBeNull();
    });
  });

  describe('openBriefing / closeBriefing / beginMission', () => {
    it('openBriefing sets currentMission and showBriefing', () => {
      useCampaignStore.getState().openBriefing(2);
      const state = useCampaignStore.getState();
      expect(state.currentMission?.id).toBe(2);
      expect(state.showBriefing).toBe(true);
    });

    it('openBriefing does nothing for invalid ID', () => {
      useCampaignStore.getState().openBriefing(999);
      expect(useCampaignStore.getState().showBriefing).toBe(false);
      expect(useCampaignStore.getState().currentMission).toBeNull();
    });

    it('closeBriefing sets showBriefing to false', () => {
      useCampaignStore.setState({ showBriefing: true });
      useCampaignStore.getState().closeBriefing();
      expect(useCampaignStore.getState().showBriefing).toBe(false);
    });

    it('beginMission sets showBriefing to false', () => {
      useCampaignStore.setState({ showBriefing: true });
      useCampaignStore.getState().beginMission();
      expect(useCampaignStore.getState().showBriefing).toBe(false);
    });
  });

  describe('completeMission', () => {
    beforeEach(() => {
      useCampaignStore.getState().setCurrentMission(1);
    });

    it('returns 0 and does nothing when no currentMission', () => {
      useCampaignStore.setState({ currentMission: null });
      const stars = useCampaignStore.getState().completeMission({ won: true, turns: 20, accuracyPct: 60, shipsLost: 0 });
      expect(stars).toBe(0);
    });

    it('returns 0 stars when player loses', () => {
      const stars = useCampaignStore.getState().completeMission({ won: false, turns: 50, accuracyPct: 20, shipsLost: 3 });
      expect(stars).toBe(0);
    });

    it('returns 1 star for a win that misses 2-star threshold', () => {
      // Mission 1: twoStars requires maxTurns: 35
      const stars = useCampaignStore.getState().completeMission({ won: true, turns: 40, accuracyPct: 30, shipsLost: 2 });
      expect(stars).toBe(1);
    });

    it('returns 2 stars when 2-star threshold is met but not 3-star', () => {
      // Mission 1: twoStars maxTurns: 35, threeStars maxTurns: 25 + noShipsLost
      const stars = useCampaignStore.getState().completeMission({ won: true, turns: 30, accuracyPct: 50, shipsLost: 1 });
      expect(stars).toBe(2);
    });

    it('returns 3 stars when all thresholds met', () => {
      // Mission 1: threeStars maxTurns: 25 + noShipsLost
      const stars = useCampaignStore.getState().completeMission({ won: true, turns: 24, accuracyPct: 60, shipsLost: 0 });
      expect(stars).toBe(3);
    });

    it('records progress with stars and bestTurns', () => {
      useCampaignStore.getState().completeMission({ won: true, turns: 24, accuracyPct: 60, shipsLost: 0 });
      const state = useCampaignStore.getState();
      expect(state.progress[1]?.stars).toBe(3);
      expect(state.progress[1]?.bestTurns).toBe(24);
    });

    it('does not downgrade stars on repeat attempt', () => {
      // First get 3 stars
      useCampaignStore.getState().completeMission({ won: true, turns: 24, accuracyPct: 60, shipsLost: 0 });
      // Retry with worse score
      useCampaignStore.getState().completeMission({ won: true, turns: 40, accuracyPct: 30, shipsLost: 2 });
      expect(useCampaignStore.getState().progress[1]?.stars).toBe(3);
    });

    it('keeps best (lowest) turn count across attempts', () => {
      useCampaignStore.getState().completeMission({ won: true, turns: 30, accuracyPct: 50, shipsLost: 1 });
      useCampaignStore.getState().completeMission({ won: true, turns: 28, accuracyPct: 50, shipsLost: 1 });
      expect(useCampaignStore.getState().progress[1]?.bestTurns).toBe(28);
    });

    it('unlocks next mission on win', () => {
      useCampaignStore.getState().completeMission({ won: true, turns: 30, accuracyPct: 50, shipsLost: 1 });
      expect(useCampaignStore.getState().highestUnlocked).toBe(2);
    });

    it('does not advance highestUnlocked on loss', () => {
      useCampaignStore.getState().completeMission({ won: false, turns: 50, accuracyPct: 20, shipsLost: 3 });
      expect(useCampaignStore.getState().highestUnlocked).toBe(1);
    });

    it('caps highestUnlocked at total mission count (15)', () => {
      useCampaignStore.getState().setCurrentMission(15);
      useCampaignStore.setState({ highestUnlocked: 15 });
      useCampaignStore.getState().completeMission({ won: true, turns: 30, accuracyPct: 50, shipsLost: 0 });
      expect(useCampaignStore.getState().highestUnlocked).toBe(15);
    });

    it('sets showOutro true on win', () => {
      useCampaignStore.getState().completeMission({ won: true, turns: 30, accuracyPct: 50, shipsLost: 1 });
      expect(useCampaignStore.getState().showOutro).toBe(true);
    });

    it('does not set showOutro on loss', () => {
      useCampaignStore.getState().completeMission({ won: false, turns: 50, accuracyPct: 20, shipsLost: 3 });
      expect(useCampaignStore.getState().showOutro).toBe(false);
    });

    it('sets lastResult with stars, turns, and missionId', () => {
      useCampaignStore.getState().completeMission({ won: true, turns: 24, accuracyPct: 60, shipsLost: 0 });
      const lastResult = useCampaignStore.getState().lastResult;
      expect(lastResult?.stars).toBe(3);
      expect(lastResult?.turns).toBe(24);
      expect(lastResult?.missionId).toBe(1);
    });

    it('saves to localStorage after completion', () => {
      useCampaignStore.getState().completeMission({ won: true, turns: 30, accuracyPct: 50, shipsLost: 1 });
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.progress[1]).toBeDefined();
      expect(stored.highestUnlocked).toBe(2);
    });

    it('calls server save endpoint when token provided', () => {
      mockApiFetch.mockResolvedValueOnce({});
      useCampaignStore.getState().completeMission(
        { won: true, turns: 24, accuracyPct: 60, shipsLost: 0 },
        'token123'
      );
      expect(mockApiFetch).toHaveBeenCalledWith('/campaign/complete', expect.objectContaining({
        method: 'POST',
        token: 'token123',
        json: expect.objectContaining({ missionId: 1, stars: 3, turns: 24 }),
      }));
    });

    it('does not call server when no token', () => {
      useCampaignStore.getState().completeMission({ won: true, turns: 24, accuracyPct: 60, shipsLost: 0 });
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('closeOutro', () => {
    it('clears showOutro and lastResult', () => {
      useCampaignStore.setState({
        showOutro: true,
        lastResult: { stars: 3, turns: 24, missionId: 1 },
      });
      useCampaignStore.getState().closeOutro();
      const state = useCampaignStore.getState();
      expect(state.showOutro).toBe(false);
      expect(state.lastResult).toBeNull();
    });
  });

  describe('isMissionUnlocked', () => {
    it('returns true for mission 1 (always unlocked initially)', () => {
      expect(useCampaignStore.getState().isMissionUnlocked(1)).toBe(true);
    });

    it('returns false for missions beyond highestUnlocked', () => {
      useCampaignStore.setState({ highestUnlocked: 2 });
      expect(useCampaignStore.getState().isMissionUnlocked(3)).toBe(false);
    });

    it('returns true for mission at exactly highestUnlocked', () => {
      useCampaignStore.setState({ highestUnlocked: 3 });
      expect(useCampaignStore.getState().isMissionUnlocked(3)).toBe(true);
    });

    it('sequential unlock: completing mission N unlocks mission N+1', () => {
      useCampaignStore.getState().setCurrentMission(1);
      useCampaignStore.getState().completeMission({ won: true, turns: 30, accuracyPct: 50, shipsLost: 1 });
      expect(useCampaignStore.getState().isMissionUnlocked(2)).toBe(true);
      expect(useCampaignStore.getState().isMissionUnlocked(3)).toBe(false);
    });
  });

  describe('getStars', () => {
    it('returns 0 for a mission with no progress', () => {
      expect(useCampaignStore.getState().getStars(1)).toBe(0);
    });

    it('returns recorded star count', () => {
      useCampaignStore.setState({ progress: { 5: { stars: 2, bestTurns: 30 } } });
      expect(useCampaignStore.getState().getStars(5)).toBe(2);
    });
  });

  describe('totalStars', () => {
    it('returns 0 with no progress', () => {
      expect(useCampaignStore.getState().totalStars()).toBe(0);
    });

    it('sums stars across all completed missions', () => {
      useCampaignStore.setState({
        progress: {
          1: { stars: 3, bestTurns: 20 },
          2: { stars: 2, bestTurns: 28 },
          3: { stars: 1, bestTurns: 35 },
        },
      });
      expect(useCampaignStore.getState().totalStars()).toBe(6);
    });
  });
});
