import { create } from 'zustand';
import {
  CAMPAIGN_MISSIONS,
  calculateStars,
  getMission,
  type CampaignMission,
} from '@shared/index';
import { apiFetchSafe, apiFetch } from '../services/apiClient';

const STORAGE_KEY = 'battleships_campaign_progress';

interface CampaignProgressResponse {
  progress?: {
    missionStars?: Record<number, MissionResult>;
    highestUnlocked?: number;
  };
}

export interface MissionResult {
  stars: number;
  bestTurns: number;
}

interface CampaignStore {
  progress: Record<number, MissionResult>;
  highestUnlocked: number;
  currentMission: CampaignMission | null;
  showBriefing: boolean;
  showOutro: boolean;
  lastResult: { stars: number; turns: number; missionId: number } | null;

  loadProgress: (token?: string | null, userId?: string | null) => Promise<void>;
  saveProgressLocal: () => void;
  setCurrentMission: (id: number) => void;
  openBriefing: (id: number) => void;
  closeBriefing: () => void;
  beginMission: () => void;
  completeMission: (
    result: { won: boolean; turns: number; accuracyPct: number; shipsLost: number },
    token?: string | null
  ) => number;
  closeOutro: () => void;
  isMissionUnlocked: (id: number) => boolean;
  getStars: (id: number) => number;
  totalStars: () => number;
}

export const useCampaignStore = create<CampaignStore>((set, get) => ({
  progress: {},
  highestUnlocked: 1,
  currentMission: null,
  showBriefing: false,
  showOutro: false,
  lastResult: null,

  loadProgress: async (token, userId) => {
    // Try server first
    if (token && userId) {
      const data = await apiFetchSafe<CampaignProgressResponse>(`/campaign/${userId}`, { token });
      if (data?.progress) {
        set({
          progress: data.progress.missionStars ?? {},
          highestUnlocked: data.progress.highestUnlocked ?? 1,
        });
        return;
      }
    }
    // Local fallback
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          progress: data.progress ?? {},
          highestUnlocked: data.highestUnlocked ?? 1,
        });
      }
    } catch {}
  },

  saveProgressLocal: () => {
    const { progress, highestUnlocked } = get();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ progress, highestUnlocked }));
    } catch {}
  },

  setCurrentMission: (id) => {
    const mission = getMission(id);
    if (mission) set({ currentMission: mission });
  },

  openBriefing: (id) => {
    const mission = getMission(id);
    if (mission) set({ currentMission: mission, showBriefing: true });
  },

  closeBriefing: () => set({ showBriefing: false }),

  beginMission: () => set({ showBriefing: false }),

  completeMission: (result, token) => {
    const { currentMission, progress, highestUnlocked, saveProgressLocal } = get();
    if (!currentMission) return 0;
    const stars = calculateStars(currentMission, result);
    const prev = progress[currentMission.id];
    const newProgress = { ...progress };
    newProgress[currentMission.id] = {
      stars: Math.max(prev?.stars ?? 0, stars),
      bestTurns: prev ? Math.min(prev.bestTurns, result.turns) : result.turns,
    };
    const newHighest = result.won
      ? Math.max(highestUnlocked, currentMission.id + 1)
      : highestUnlocked;
    const cappedHighest = Math.min(newHighest, CAMPAIGN_MISSIONS.length);

    set({
      progress: newProgress,
      highestUnlocked: cappedHighest,
      showOutro: result.won,
      lastResult: { stars, turns: result.turns, missionId: currentMission.id },
    });
    saveProgressLocal();

    // Best-effort server save
    if (token) {
      apiFetch('/campaign/complete', {
        method: 'POST',
        token,
        json: {
          missionId: currentMission.id,
          stars,
          turns: result.turns,
          accuracyPct: result.accuracyPct,
          shipsLost: result.shipsLost,
        },
      }).catch(() => {});
    }

    return stars;
  },

  closeOutro: () => set({ showOutro: false, lastResult: null }),

  isMissionUnlocked: (id) => id <= get().highestUnlocked,

  getStars: (id) => get().progress[id]?.stars ?? 0,

  totalStars: () => Object.values(get().progress).reduce((sum, m) => sum + m.stars, 0),
}));
