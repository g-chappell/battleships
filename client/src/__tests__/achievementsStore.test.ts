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

import { useAchievementsStore } from '../store/achievementsStore';
import { ACHIEVEMENT_DEFS } from '@shared/index';

const STORAGE_KEY = 'battleships_achievements_unlocked';

describe('achievementsStore', () => {
  beforeEach(() => {
    useAchievementsStore.setState({
      unlocked: new Set(),
      toastQueue: [],
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAchievementsStore.getState();
    expect(state.unlocked).toEqual(new Set());
    expect(state.toastQueue).toEqual([]);
  });

  describe('unlock', () => {
    it('adds the achievement ID to unlocked set', () => {
      useAchievementsStore.getState().unlock('first_blood');
      expect(useAchievementsStore.getState().unlocked.has('first_blood')).toBe(true);
    });

    it('adds the achievement def to toastQueue', () => {
      useAchievementsStore.getState().unlock('first_blood');
      const { toastQueue } = useAchievementsStore.getState();
      expect(toastQueue).toHaveLength(1);
      expect(toastQueue[0]).toBe(ACHIEVEMENT_DEFS['first_blood']);
    });

    it('persists unlocked IDs to localStorage', () => {
      useAchievementsStore.getState().unlock('first_blood');
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toContain('first_blood');
    });

    it('does not double-unlock an already-unlocked achievement', () => {
      useAchievementsStore.getState().unlock('first_blood');
      useAchievementsStore.getState().unlock('first_blood');
      expect(useAchievementsStore.getState().unlocked.size).toBe(1);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(1);
    });

    it('does not unlock an unknown achievement ID', () => {
      useAchievementsStore.getState().unlock('nonexistent_achievement');
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('persists multiple unlocked IDs to localStorage', () => {
      useAchievementsStore.getState().unlock('first_blood');
      useAchievementsStore.getState().unlock('sharpshooter');
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored).toContain('first_blood');
      expect(stored).toContain('sharpshooter');
    });

    it('does not add toast for already-unlocked achievement', () => {
      useAchievementsStore.setState({ unlocked: new Set(['first_blood']), toastQueue: [] });
      useAchievementsStore.getState().unlock('first_blood');
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });
  });

  describe('unlockMany', () => {
    it('unlocks all provided IDs', () => {
      useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter']);
      const { unlocked } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(unlocked.has('sharpshooter')).toBe(true);
    });

    it('queues one toast per newly unlocked achievement', () => {
      useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter']);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(2);
    });

    it('skips already-unlocked achievements', () => {
      useAchievementsStore.setState({ unlocked: new Set(['first_blood']), toastQueue: [] });
      useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter']);
      const { unlocked, toastQueue } = useAchievementsStore.getState();
      expect(unlocked.size).toBe(2);
      expect(toastQueue).toHaveLength(1);
      expect(toastQueue[0].id).toBe('sharpshooter');
    });

    it('does nothing with an empty array', () => {
      useAchievementsStore.getState().unlockMany([]);
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('skips unknown IDs without affecting valid ones', () => {
      useAchievementsStore.getState().unlockMany(['nonexistent', 'first_blood']);
      const { unlocked, toastQueue } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(unlocked.has('nonexistent')).toBe(false);
      expect(toastQueue).toHaveLength(1);
    });
  });

  describe('dismissToast', () => {
    it('removes the first item from toastQueue', () => {
      useAchievementsStore.getState().unlockMany(['first_blood', 'sharpshooter']);
      useAchievementsStore.getState().dismissToast();
      const { toastQueue } = useAchievementsStore.getState();
      expect(toastQueue).toHaveLength(1);
      expect(toastQueue[0].id).toBe('sharpshooter');
    });

    it('empties the queue when only one item remains', () => {
      useAchievementsStore.getState().unlock('first_blood');
      useAchievementsStore.getState().dismissToast();
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('does nothing when toastQueue is already empty', () => {
      useAchievementsStore.getState().dismissToast();
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });
  });

  describe('loadFromStorage', () => {
    it('loads unlocked IDs from localStorage into a Set', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['first_blood', 'veteran']));
      useAchievementsStore.getState().loadFromStorage();
      const { unlocked } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(unlocked.has('veteran')).toBe(true);
    });

    it('does not populate toastQueue when loading from storage', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['first_blood']));
      useAchievementsStore.getState().loadFromStorage();
      expect(useAchievementsStore.getState().toastQueue).toHaveLength(0);
    });

    it('does nothing when localStorage is empty', () => {
      useAchievementsStore.getState().loadFromStorage();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('handles malformed JSON gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'not-valid-json{');
      expect(() => useAchievementsStore.getState().loadFromStorage()).not.toThrow();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });

    it('overwrites current unlocked set with stored values', () => {
      useAchievementsStore.setState({ unlocked: new Set(['sharpshooter']), toastQueue: [] });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(['first_blood']));
      useAchievementsStore.getState().loadFromStorage();
      const { unlocked } = useAchievementsStore.getState();
      expect(unlocked.has('first_blood')).toBe(true);
      expect(unlocked.has('sharpshooter')).toBe(false);
    });

    it('loads an empty array as an empty unlocked set', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      useAchievementsStore.getState().loadFromStorage();
      expect(useAchievementsStore.getState().unlocked.size).toBe(0);
    });
  });
});
