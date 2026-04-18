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

vi.mock('../services/apiClient', () => ({
  apiFetch: vi.fn(),
  apiFetchSafe: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data?: unknown) {
      super(message);
      this.status = status;
      this.data = data;
    }
  },
}));

import { useAchievementsStore } from '../store/achievementsStore';
import { ACHIEVEMENT_DEFS } from '@shared/index';
import { apiFetch, apiFetchSafe } from '../services/apiClient';

const mockApiFetch = vi.mocked(apiFetch);
const mockApiFetchSafe = vi.mocked(apiFetchSafe);

const REG_TOKEN = 'tok_registered';
const REG_USER = 'user_123';
const GUEST_USER = 'guest_abc';

function makeCatalog(unlockedIds: string[] = []) {
  return {
    catalog: Object.keys(ACHIEVEMENT_DEFS).map((id) => ({
      id,
      unlockedAt: unlockedIds.includes(id) ? '2024-01-01T00:00:00.000Z' : null,
    })),
  };
}

describe('achievementsStore', () => {
  beforeEach(() => {
    useAchievementsStore.setState({
      unlocked: new Set(),
      unlockedDates: new Map(),
      toastQueue: [],
    });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAchievementsStore.getState();
    expect(state.unlocked).toEqual(new Set());
    expect(state.unlockedDates).toEqual(new Map());
    expect(state.toastQueue).toEqual([]);
  });

  // ---- loadFromServer ----

  describe('loadFromServer', () => {
    it('loads unlocked IDs from server catalog', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(makeCatalog(['first_blood', 'veteran']));
      await useAchievementsStore.getState().loadFromServer(REG_TOKEN);
      const { unlocked } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(unlocked.has('veteran')).toBe(true);
    });

    it('does not populate toastQueue when loading from server', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(makeCatalog(['first_blood']));
      await useAchievementsStore.getState().loadFromServer(REG_TOKEN);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('ignores catalog items with null unlockedAt', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(makeCatalog([]));
      await useAchievementsStore.getState().loadFromServer(REG_TOKEN);
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('replaces unlocked set with server state', async () => {
      useAchievementsStore.setState({ unlocked: new Set(['sharpshooter']), toastQueue: [] });
      mockApiFetchSafe.mockResolvedValueOnce(makeCatalog(['first_blood']));
      await useAchievementsStore.getState().loadFromServer(REG_TOKEN);
      const { unlocked } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(unlocked.has('sharpshooter')).toBe(false);
    });

    it('does nothing when server returns null (network failure)', async () => {
      useAchievementsStore.setState({ unlocked: new Set(['first_blood']), unlockedDates: new Map(), toastQueue: [] });
      mockApiFetchSafe.mockResolvedValueOnce(null);
      await useAchievementsStore.getState().loadFromServer(REG_TOKEN);
      expect(useAchievementsStore.getState().unlocked.has('first_blood')).toBe(true);
    });

    it('populates unlockedDates for achievements with a date', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(makeCatalog(['first_blood']));
      await useAchievementsStore.getState().loadFromServer(REG_TOKEN);
      const { unlockedDates } = useAchievementsStore.getState();
      expect(unlockedDates.get('first_blood')).toBe('2024-01-01T00:00:00.000Z');
      expect(unlockedDates.has('sharpshooter')).toBe(false);
    });

    it('passes token to apiFetchSafe', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(makeCatalog([]));
      await useAchievementsStore.getState().loadFromServer(REG_TOKEN);
      expect(mockApiFetchSafe).toHaveBeenCalledWith('/achievements', { token: REG_TOKEN });
    });
  });

  // ---- unlock ----

  describe('unlock', () => {
    it('adds to unlocked set and queues toast for registered user', async () => {
      mockApiFetch.mockResolvedValueOnce({ achievementId: 'first_blood', unlockedAt: '2024-01-01T00:00:00.000Z' });
      await useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, REG_USER);
      const { unlocked, toastQueue } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(toastQueue).toHaveLength(1);
      expect(toastQueue[0]).toBe(ACHIEVEMENT_DEFS['first_blood']);
    });

    it('records unlock date in unlockedDates', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      await useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, REG_USER);
      const { unlockedDates } = useAchievementsStore.getState();
      expect(unlockedDates.has('first_blood')).toBe(true);
      expect(typeof unlockedDates.get('first_blood')).toBe('string');
    });

    it('calls POST /achievements/unlock with token', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      await useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, REG_USER);
      expect(mockApiFetch).toHaveBeenCalledWith('/achievements/unlock', {
        method: 'POST',
        json: { achievementId: 'first_blood' },
        token: REG_TOKEN,
      });
    });

    it('is a no-op for guest users (userId starts with guest_)', async () => {
      await useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, GUEST_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('is a no-op when token is null', async () => {
      await useAchievementsStore.getState().unlock('first_blood', null, REG_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('is a no-op when userId is null', async () => {
      await useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, null);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('does not double-unlock an already-unlocked achievement', async () => {
      useAchievementsStore.setState({ unlocked: new Set(['first_blood']), toastQueue: [] });
      await useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, REG_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('does not unlock an unknown achievement ID', async () => {
      await useAchievementsStore.getState().unlock('nonexistent_achievement', REG_TOKEN, REG_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('silently ignores server errors', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Server error'));
      await expect(
        useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, REG_USER),
      ).resolves.not.toThrow();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });
  });

  // ---- unlockMany ----

  describe('unlockMany', () => {
    it('unlocks all provided IDs for registered user', async () => {
      mockApiFetch.mockResolvedValue({});
      await useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter'], REG_TOKEN, REG_USER);
      const { unlocked } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(unlocked.has('sharpshooter')).toBe(true);
    });

    it('queues one toast per newly unlocked achievement', async () => {
      mockApiFetch.mockResolvedValue({});
      await useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter'], REG_TOKEN, REG_USER);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(2);
    });

    it('skips already-unlocked achievements', async () => {
      useAchievementsStore.setState({ unlocked: new Set(['first_blood']), toastQueue: [] });
      mockApiFetch.mockResolvedValue({});
      await useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter'], REG_TOKEN, REG_USER);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(1);
      expect(useAchievementsStore.getState().toastQueue[0].id).toBe('sharpshooter');
    });

    it('is a no-op for guests', async () => {
      await useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter'], REG_TOKEN, GUEST_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('does nothing with an empty array', async () => {
      await useAchievementsStore.getState().unlockMany([], REG_TOKEN, REG_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });
  });

  // ---- checkAchievements ----

  describe('checkAchievements', () => {
    const baseCtx = {
      won: true,
      isMultiplayer: false,
      isRanked: false,
      isCampaign: false,
      turns: 20,
      shotsFired: 25,
      shotsHit: 20,
      shipsSunk: 1,
      shipsLost: 0,
      durationMs: 0,
      abilitiesUsed: {},
      abilitySinks: {},
      ironcladSaved: false,
      submarineSonarBlocked: false,
      totalGames: 1,
      totalWins: 1,
      totalShipsSunk: 1,
      rating: 1200,
    };

    it('is a no-op for guest users', async () => {
      await useAchievementsStore.getState().checkAchievements(baseCtx, REG_TOKEN, GUEST_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('is a no-op when token is null', async () => {
      await useAchievementsStore.getState().checkAchievements(baseCtx, null, REG_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('is a no-op when userId is null', async () => {
      await useAchievementsStore.getState().checkAchievements(baseCtx, REG_TOKEN, null);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('unlocks newly earned achievements for registered user', async () => {
      mockApiFetch.mockResolvedValue({});
      await useAchievementsStore.getState().checkAchievements(baseCtx, REG_TOKEN, REG_USER);
      // baseCtx has shipsSunk=1 → first_blood, won && shipsLost=0 → untouchable
      const { unlocked } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
    });

    it('skips achievements already in unlocked set', async () => {
      useAchievementsStore.setState({ unlocked: new Set(['first_blood']), toastQueue: [] });
      mockApiFetch.mockResolvedValue({});
      await useAchievementsStore.getState().checkAchievements(baseCtx, REG_TOKEN, REG_USER);
      // first_blood already unlocked — should not call apiFetch for it
      const calls = mockApiFetch.mock.calls.map((c) => (c[1] as { json: { achievementId: string } }).json.achievementId);
      expect(calls).not.toContain('first_blood');
    });

    it('does nothing when no achievements are earned', async () => {
      const emptyCtx = {
        ...baseCtx,
        won: false,
        shipsSunk: 0,
        shipsLost: 5,
        shotsFired: 100,
        shotsHit: 0,
        turns: 100,
        totalGames: 1,
        totalWins: 0,
        totalShipsSunk: 0,
        rating: 1200,
      };
      await useAchievementsStore.getState().checkAchievements(emptyCtx, REG_TOKEN, REG_USER);
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  // ---- dismissToast ----

  describe('dismissToast', () => {
    it('removes the first item from toastQueue', async () => {
      mockApiFetch.mockResolvedValue({});
      await useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter'], REG_TOKEN, REG_USER);
      useAchievementsStore.getState().dismissToast();
      const { toastQueue } = useAchievementsStore.getState();
      expect(toastQueue).toHaveLength(1);
      expect(toastQueue[0].id).toBe('sharpshooter');
    });

    it('empties the queue when only one item remains', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      await useAchievementsStore.getState().unlock('first_blood', REG_TOKEN, REG_USER);
      useAchievementsStore.getState().dismissToast();
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('does nothing when toastQueue is already empty', () => {
      useAchievementsStore.getState().dismissToast();
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });
  });
});
