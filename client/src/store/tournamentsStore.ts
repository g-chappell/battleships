import { create } from 'zustand';
import type { TournamentSummary, TournamentDetail } from '@shared/index';
import { apiFetch, apiFetchSafe, ApiError } from '../services/apiClient';

interface TournamentsListResponse { tournaments?: TournamentSummary[] }
interface TournamentDetailResponse { tournament?: TournamentDetail | null }
interface CreateTournamentResponse { id: string }

interface TournamentsStore {
  list: TournamentSummary[];
  current: TournamentDetail | null;
  loading: boolean;
  error: string | null;

  fetchList: () => Promise<void>;
  fetchOne: (id: string) => Promise<void>;
  create: (name: string, maxPlayers: number, token: string) => Promise<{ id: string } | { error: string }>;
  join: (id: string, token: string) => Promise<{ ok: true } | { error: string }>;
}

export const useTournamentsStore = create<TournamentsStore>((set, get) => ({
  list: [],
  current: null,
  loading: false,
  error: null,

  fetchList: async () => {
    set({ loading: true, error: null });
    const data = await apiFetchSafe<TournamentsListResponse>('/tournaments');
    if (data) set({ list: data.tournaments ?? [] });
    else set({ error: 'Tournaments unavailable offline' });
    set({ loading: false });
  },

  fetchOne: async (id) => {
    set({ loading: true, error: null });
    const data = await apiFetchSafe<TournamentDetailResponse>(`/tournaments/${id}`);
    if (data) set({ current: data.tournament ?? null });
    else set({ error: 'Tournament not found' });
    set({ loading: false });
  },

  create: async (name, maxPlayers, token) => {
    try {
      const data = await apiFetch<CreateTournamentResponse>('/tournaments', {
        method: 'POST',
        token,
        json: { name, maxPlayers },
      });
      await get().fetchList();
      return data;
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Tournaments unavailable offline' };
    }
  },

  join: async (id, token) => {
    try {
      await apiFetch(`/tournaments/${id}/join`, { method: 'POST', token });
      await get().fetchOne(id);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Tournaments unavailable offline' };
    }
  },
}));
