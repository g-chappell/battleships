import { create } from 'zustand';
import type { ClanDetail, ClanSummary, ClanChatMessageType } from '@shared/index';
import { apiFetchSafe, apiFetch, ApiError } from '../services/apiClient';

interface ClansListResponse { clans?: ClanSummary[] }
interface ClanDetailResponse { clan?: ClanDetail & { recentChat?: ClanChatMessageType[] } }
interface CreateClanResponse { clanId: string }

interface ClanStore {
  myClanId: string | null;
  myClan: ClanDetail | null;
  browse: ClanSummary[];
  leaderboard: ClanSummary[];
  chatMessages: ClanChatMessageType[];
  loading: boolean;
  error: string | null;

  fetchBrowse: (search?: string) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchMyClan: (clanId: string) => Promise<void>;
  createClan: (name: string, tag: string, description: string | undefined, token: string) => Promise<{ ok: true } | { error: string }>;
  joinClan: (id: string, token: string) => Promise<{ ok: true } | { error: string }>;
  leaveClan: (token: string) => Promise<void>;
  sendChat: (text: string, token: string) => Promise<void>;
  appendChatFromSocket: (msg: ClanChatMessageType) => void;
}

export const useClanStore = create<ClanStore>((set, get) => ({
  myClanId: null,
  myClan: null,
  browse: [],
  leaderboard: [],
  chatMessages: [],
  loading: false,
  error: null,

  fetchBrowse: async (search) => {
    set({ loading: true, error: null });
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    const data = await apiFetchSafe<ClansListResponse>(`/clans${q}`);
    if (data) set({ browse: data.clans ?? [] });
    else set({ error: 'Offline' });
    set({ loading: false });
  },

  fetchLeaderboard: async () => {
    const data = await apiFetchSafe<ClansListResponse>('/clans/leaderboard');
    if (data) set({ leaderboard: data.clans ?? [] });
  },

  fetchMyClan: async (clanId) => {
    set({ loading: true });
    const data = await apiFetchSafe<ClanDetailResponse>(`/clans/${clanId}`);
    if (data) {
      set({
        myClan: data.clan ?? null,
        myClanId: clanId,
        chatMessages: data.clan?.recentChat ?? [],
      });
    }
    set({ loading: false });
  },

  createClan: async (name, tag, description, token) => {
    try {
      const data = await apiFetch<CreateClanResponse>('/clans', {
        method: 'POST',
        token,
        json: { name, tag, description },
      });
      set({ myClanId: data.clanId });
      await get().fetchMyClan(data.clanId);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Clans unavailable offline' };
    }
  },

  joinClan: async (id, token) => {
    try {
      await apiFetch(`/clans/${id}/join`, { method: 'POST', token });
      set({ myClanId: id });
      await get().fetchMyClan(id);
      return { ok: true };
    } catch (err) {
      return { error: err instanceof ApiError ? err.message : 'Clans unavailable offline' };
    }
  },

  leaveClan: async (token) => {
    await apiFetchSafe('/clans/leave', { method: 'POST', token });
    set({ myClan: null, myClanId: null, chatMessages: [] });
  },

  sendChat: async (text, token) => {
    const clanId = get().myClanId;
    if (!clanId) return;
    await apiFetchSafe(`/clans/${clanId}/chat`, { method: 'POST', token, json: { text } });
  },

  appendChatFromSocket: (msg) => {
    set((s) => ({ chatMessages: [...s.chatMessages, msg].slice(-50) }));
  },
}));
