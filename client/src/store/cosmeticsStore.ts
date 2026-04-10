import { create } from 'zustand';
import type { CosmeticKind } from '@shared/index';
import { apiFetch, apiFetchSafe, ApiError } from '../services/apiClient';

const STORAGE_KEY = 'battleships_cosmetics_v1';

export interface EquippedCosmetics {
  shipSkin: string;
  boardTheme: string;
  explosionFx: string;
}

interface CosmeticsMeResponse {
  gold?: number;
  owned?: string[];
  equipped?: EquippedCosmetics;
}

interface BuyResponse {
  newBalance: number;
}

interface CosmeticsStore {
  gold: number;
  owned: Set<string>;
  equipped: EquippedCosmetics;
  loading: boolean;

  loadFromStorage: () => void;
  loadFromServer: (token: string) => Promise<void>;
  buy: (id: string, price: number, token?: string | null) => Promise<'ok' | 'insufficient' | 'owned' | 'error'>;
  equip: (id: string, kind: CosmeticKind, token?: string | null) => void;
  addGold: (n: number) => void;
  resetGoldForGuest: () => void;
}

function persist(state: { gold: number; owned: string[]; equipped: EquippedCosmetics }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

const DEFAULT_EQUIPPED: EquippedCosmetics = {
  shipSkin: 'default',
  boardTheme: 'default',
  explosionFx: 'default',
};

export const useCosmeticsStore = create<CosmeticsStore>((set, get) => ({
  gold: 0,
  owned: new Set(['default']),
  equipped: { ...DEFAULT_EQUIPPED },
  loading: false,

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          gold: data.gold ?? 0,
          owned: new Set(data.owned ?? ['default']),
          equipped: data.equipped ?? DEFAULT_EQUIPPED,
        });
      }
    } catch {}
  },

  resetGoldForGuest: () => {
    set({ gold: 0 });
    persist({ gold: 0, owned: Array.from(get().owned), equipped: get().equipped });
  },

  loadFromServer: async (token) => {
    set({ loading: true });
    const data = await apiFetchSafe<CosmeticsMeResponse>('/cosmetics/me', { token });
    if (data) {
      const owned = new Set<string>(['default', ...(data.owned ?? [])]);
      const equipped = data.equipped ?? DEFAULT_EQUIPPED;
      set({ gold: data.gold ?? 0, owned, equipped });
      persist({ gold: data.gold ?? 0, owned: Array.from(owned), equipped });
    }
    set({ loading: false });
  },

  buy: async (id, price, token) => {
    const { gold, owned } = get();
    if (owned.has(id)) return 'owned';
    if (gold < price) return 'insufficient';

    // Server attempt
    if (token) {
      try {
        const data = await apiFetch<BuyResponse>('/cosmetics/buy', {
          method: 'POST',
          token,
          json: { cosmeticId: id },
        });
        const newOwned = new Set(owned);
        newOwned.add(id);
        set({ gold: data.newBalance, owned: newOwned });
        persist({ gold: data.newBalance, owned: Array.from(newOwned), equipped: get().equipped });
        return 'ok';
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.message === 'Insufficient gold') return 'insufficient';
          if (err.message === 'Already owned') return 'owned';
        }
        // Fall through to local mode
      }
    }

    // Local fallback
    const newOwned = new Set(owned);
    newOwned.add(id);
    const newGold = gold - price;
    set({ gold: newGold, owned: newOwned });
    persist({ gold: newGold, owned: Array.from(newOwned), equipped: get().equipped });
    return 'ok';
  },

  equip: (id, kind, token) => {
    const equipped = { ...get().equipped };
    if (kind === 'ship_skin') equipped.shipSkin = id;
    else if (kind === 'board_theme') equipped.boardTheme = id;
    else equipped.explosionFx = id;
    set({ equipped });
    persist({ gold: get().gold, owned: Array.from(get().owned), equipped });

    if (token) {
      apiFetch('/cosmetics/equip', {
        method: 'POST',
        token,
        json: { cosmeticId: id, kind },
      }).catch(() => {});
    }
  },

  addGold: (n) => {
    const newGold = get().gold + n;
    set({ gold: newGold });
    persist({ gold: newGold, owned: Array.from(get().owned), equipped: get().equipped });
  },
}));
