import { create } from 'zustand';
import { ACHIEVEMENT_DEFS, type AchievementDef } from '@shared/index';

interface AchievementsStore {
  unlocked: Set<string>;
  toastQueue: AchievementDef[]; // queued unlocks to display
  unlock: (id: string) => void;
  unlockMany: (ids: string[]) => void;
  dismissToast: () => void;
  loadFromStorage: () => void;
}

const STORAGE_KEY = 'battleships_achievements_unlocked';

export const useAchievementsStore = create<AchievementsStore>((set, get) => ({
  unlocked: new Set(),
  toastQueue: [],

  unlock: (id) => {
    if (get().unlocked.has(id)) return;
    const def = ACHIEVEMENT_DEFS[id];
    if (!def) return;
    set((s) => {
      const next = new Set(s.unlocked);
      next.add(id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {}
      return {
        unlocked: next,
        toastQueue: [...s.toastQueue, def],
      };
    });
  },

  unlockMany: (ids) => {
    for (const id of ids) get().unlock(id);
  },

  dismissToast: () => {
    set((s) => ({ toastQueue: s.toastQueue.slice(1) }));
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        set({ unlocked: new Set(arr) });
      }
    } catch {}
  },
}));
