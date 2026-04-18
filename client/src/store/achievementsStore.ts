import { create } from 'zustand';
import { ACHIEVEMENT_DEFS, type AchievementDef, type MatchEvaluationContext, newlyUnlocked } from '@shared/index';
import { apiFetch, apiFetchSafe } from '../services/apiClient';

interface AchievementCatalogItem {
  id: string;
  unlockedAt: string | null;
}

interface AchievementsStore {
  unlocked: Set<string>;
  unlockedDates: Map<string, string>;
  toastQueue: AchievementDef[];

  loadFromServer: (token: string) => Promise<void>;
  unlock: (id: string, token: string | null, userId: string | null) => Promise<void>;
  unlockMany: (ids: string[], token: string | null, userId: string | null) => Promise<void>;
  checkAchievements: (ctx: MatchEvaluationContext, token: string | null, userId: string | null) => Promise<void>;
  dismissToast: () => void;
}

function isGuest(userId: string | null): boolean {
  return !userId || userId.startsWith('guest_');
}

export const useAchievementsStore = create<AchievementsStore>((set, get) => ({
  unlocked: new Set(),
  unlockedDates: new Map(),
  toastQueue: [],

  loadFromServer: async (token) => {
    const data = await apiFetchSafe<{ catalog: AchievementCatalogItem[] }>(
      '/achievements',
      { token },
    );
    if (!data) return;
    const unlocked = new Set<string>();
    const unlockedDates = new Map<string, string>();
    for (const item of data.catalog) {
      if (item.unlockedAt !== null) {
        unlocked.add(item.id);
        unlockedDates.set(item.id, item.unlockedAt);
      }
    }
    set({ unlocked, unlockedDates });
  },

  unlock: async (id, token, userId) => {
    if (isGuest(userId) || !token) return;
    if (get().unlocked.has(id)) return;
    const def = ACHIEVEMENT_DEFS[id];
    if (!def) return;
    try {
      await apiFetch('/achievements/unlock', {
        method: 'POST',
        json: { achievementId: id },
        token,
      });
      const now = new Date().toISOString();
      set((s) => {
        const next = new Set(s.unlocked);
        next.add(id);
        const nextDates = new Map(s.unlockedDates);
        nextDates.set(id, now);
        return { unlocked: next, unlockedDates: nextDates, toastQueue: [...s.toastQueue, def] };
      });
    } catch {
      // Server rejection (unknown id, already unlocked, etc.) — silently ignore
    }
  },

  unlockMany: async (ids, token, userId) => {
    for (const id of ids) await get().unlock(id, token, userId);
  },

  checkAchievements: async (ctx, token, userId) => {
    if (isGuest(userId) || !token) return;
    const toUnlock = newlyUnlocked(ctx, get().unlocked);
    for (const id of toUnlock) await get().unlock(id, token, userId);
  },

  dismissToast: () => {
    set((s) => ({ toastQueue: s.toastQueue.slice(1) }));
  },
}));
