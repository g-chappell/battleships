import { create } from 'zustand';
import type { SeasonInfo } from '@shared/index';
import { apiFetchSafe } from '../services/apiClient';

interface ActiveSeasonResponse { season?: SeasonInfo | null }
interface SeasonsListResponse { seasons?: SeasonInfo[] }

interface SeasonsStore {
  activeSeason: SeasonInfo | null;
  allSeasons: SeasonInfo[];
  selectedSeasonId: string; // 'lifetime' | 'active' | seasonId
  loading: boolean;

  fetchActive: () => Promise<void>;
  fetchAll: () => Promise<void>;
  selectSeason: (id: string) => void;
}

export const useSeasonsStore = create<SeasonsStore>((set) => ({
  activeSeason: null,
  allSeasons: [],
  selectedSeasonId: 'active',
  loading: false,

  fetchActive: async () => {
    const data = await apiFetchSafe<ActiveSeasonResponse>('/seasons/active');
    if (data) set({ activeSeason: data.season ?? null });
  },

  fetchAll: async () => {
    set({ loading: true });
    const data = await apiFetchSafe<SeasonsListResponse>('/seasons');
    if (data) set({ allSeasons: data.seasons ?? [] });
    set({ loading: false });
  },

  selectSeason: (id) => set({ selectedSeasonId: id }),
}));
