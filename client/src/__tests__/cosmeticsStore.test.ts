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

import { useCosmeticsStore } from '../store/cosmeticsStore';
import { apiFetch, apiFetchSafe } from '../services/apiClient';

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
const mockApiFetchSafe = apiFetchSafe as ReturnType<typeof vi.fn>;

const STORAGE_KEY = 'battleships_cosmetics_v1';

const DEFAULT_EQUIPPED = {
  shipSkin: 'default',
  boardTheme: 'default',
  explosionFx: 'default',
};

describe('cosmeticsStore', () => {
  beforeEach(() => {
    useCosmeticsStore.setState({
      gold: 0,
      owned: new Set(['default']),
      equipped: { ...DEFAULT_EQUIPPED },
      loading: false,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useCosmeticsStore.getState();
    expect(state.gold).toBe(0);
    expect(state.owned).toEqual(new Set(['default']));
    expect(state.equipped).toEqual(DEFAULT_EQUIPPED);
    expect(state.loading).toBe(false);
  });

  describe('loadFromStorage', () => {
    it('loads gold, owned, and equipped from localStorage', () => {
      const saved = {
        gold: 250,
        owned: ['default', 'skull_skin'],
        equipped: { shipSkin: 'skull_skin', boardTheme: 'default', explosionFx: 'default' },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      useCosmeticsStore.getState().loadFromStorage();

      const state = useCosmeticsStore.getState();
      expect(state.gold).toBe(250);
      expect(state.owned).toEqual(new Set(['default', 'skull_skin']));
      expect(state.equipped.shipSkin).toBe('skull_skin');
    });

    it('does nothing when localStorage is empty', () => {
      useCosmeticsStore.getState().loadFromStorage();
      const state = useCosmeticsStore.getState();
      expect(state.gold).toBe(0);
      expect(state.owned).toEqual(new Set(['default']));
    });

    it('falls back to defaults for missing fields', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ gold: 100 }));
      useCosmeticsStore.getState().loadFromStorage();
      const state = useCosmeticsStore.getState();
      expect(state.gold).toBe(100);
      expect(state.owned).toEqual(new Set(['default']));
      expect(state.equipped).toEqual(DEFAULT_EQUIPPED);
    });
  });

  describe('loadFromServer', () => {
    it('sets gold, owned, and equipped from server response', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({
        gold: 500,
        owned: ['skull_skin', 'dark_board'],
        equipped: { shipSkin: 'skull_skin', boardTheme: 'dark_board', explosionFx: 'default' },
      });

      await useCosmeticsStore.getState().loadFromServer('token123');

      const state = useCosmeticsStore.getState();
      expect(state.gold).toBe(500);
      expect(state.owned.has('skull_skin')).toBe(true);
      expect(state.owned.has('default')).toBe(true); // always included
      expect(state.equipped.shipSkin).toBe('skull_skin');
      expect(state.equipped.boardTheme).toBe('dark_board');
      expect(state.loading).toBe(false);
    });

    it('does not update state when server returns null', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useCosmeticsStore.getState().loadFromServer('token123');

      const state = useCosmeticsStore.getState();
      expect(state.gold).toBe(0);
      expect(state.loading).toBe(false);
    });

    it('always includes default in owned after server load', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({
        gold: 100,
        owned: [],
        equipped: DEFAULT_EQUIPPED,
      });

      await useCosmeticsStore.getState().loadFromServer('token123');

      expect(useCosmeticsStore.getState().owned.has('default')).toBe(true);
    });
  });

  describe('buy', () => {
    it('returns "owned" if item is already owned', async () => {
      const result = await useCosmeticsStore.getState().buy('default', 0);
      expect(result).toBe('owned');
    });

    it('returns "insufficient" if gold is less than price', async () => {
      useCosmeticsStore.setState({ gold: 50 });
      const result = await useCosmeticsStore.getState().buy('skull_skin', 100);
      expect(result).toBe('insufficient');
    });

    it('buys locally (no token) — deducts gold and adds to owned', async () => {
      useCosmeticsStore.setState({ gold: 200 });
      const result = await useCosmeticsStore.getState().buy('skull_skin', 100);
      expect(result).toBe('ok');
      const state = useCosmeticsStore.getState();
      expect(state.gold).toBe(100);
      expect(state.owned.has('skull_skin')).toBe(true);
    });

    it('persists to localStorage after local buy', async () => {
      useCosmeticsStore.setState({ gold: 200 });
      await useCosmeticsStore.getState().buy('skull_skin', 100);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.gold).toBe(100);
      expect(stored.owned).toContain('skull_skin');
    });

    it('buys via server when token provided — uses server balance', async () => {
      useCosmeticsStore.setState({ gold: 200 });
      mockApiFetch.mockResolvedValueOnce({ newBalance: 150 });

      const result = await useCosmeticsStore.getState().buy('skull_skin', 50, 'token123');
      expect(result).toBe('ok');
      expect(useCosmeticsStore.getState().gold).toBe(150);
    });

    it('returns "insufficient" on ApiError "Insufficient gold"', async () => {
      useCosmeticsStore.setState({ gold: 200 });
      const { ApiError } = await import('../services/apiClient');
      mockApiFetch.mockRejectedValueOnce(new ApiError('Insufficient gold', 402, undefined));

      const result = await useCosmeticsStore.getState().buy('skull_skin', 50, 'token123');
      expect(result).toBe('insufficient');
    });

    it('returns "owned" on ApiError "Already owned"', async () => {
      useCosmeticsStore.setState({ gold: 200 });
      const { ApiError } = await import('../services/apiClient');
      mockApiFetch.mockRejectedValueOnce(new ApiError('Already owned', 409, undefined));

      const result = await useCosmeticsStore.getState().buy('skull_skin', 50, 'token123');
      expect(result).toBe('owned');
    });

    it('falls back to local buy on other API errors', async () => {
      useCosmeticsStore.setState({ gold: 200 });
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await useCosmeticsStore.getState().buy('skull_skin', 50, 'token123');
      expect(result).toBe('ok');
      expect(useCosmeticsStore.getState().gold).toBe(150);
    });
  });

  describe('equip', () => {
    beforeEach(() => {
      useCosmeticsStore.setState({
        gold: 0,
        owned: new Set(['default', 'skull_skin', 'dark_board', 'fire_fx']),
        equipped: { ...DEFAULT_EQUIPPED },
        loading: false,
      });
    });

    it('equips a ship_skin', () => {
      useCosmeticsStore.getState().equip('skull_skin', 'ship_skin');
      expect(useCosmeticsStore.getState().equipped.shipSkin).toBe('skull_skin');
    });

    it('equips a board_theme', () => {
      useCosmeticsStore.getState().equip('dark_board', 'board_theme');
      expect(useCosmeticsStore.getState().equipped.boardTheme).toBe('dark_board');
    });

    it('equips an explosion_fx', () => {
      useCosmeticsStore.getState().equip('fire_fx', 'explosion_fx');
      expect(useCosmeticsStore.getState().equipped.explosionFx).toBe('fire_fx');
    });

    it('does not affect other equipped slots', () => {
      useCosmeticsStore.getState().equip('skull_skin', 'ship_skin');
      const equipped = useCosmeticsStore.getState().equipped;
      expect(equipped.boardTheme).toBe('default');
      expect(equipped.explosionFx).toBe('default');
    });

    it('persists equipped state to localStorage', () => {
      useCosmeticsStore.getState().equip('skull_skin', 'ship_skin');
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.equipped.shipSkin).toBe('skull_skin');
    });

    it('calls server equip endpoint when token provided', () => {
      mockApiFetch.mockResolvedValueOnce({});
      useCosmeticsStore.getState().equip('skull_skin', 'ship_skin', 'token123');
      expect(mockApiFetch).toHaveBeenCalledWith('/cosmetics/equip', expect.objectContaining({
        method: 'POST',
        token: 'token123',
        json: { cosmeticId: 'skull_skin', kind: 'ship_skin' },
      }));
    });

    it('does not call server when no token', () => {
      useCosmeticsStore.getState().equip('skull_skin', 'ship_skin');
      expect(mockApiFetch).not.toHaveBeenCalled();
    });
  });

  describe('addGold', () => {
    it('adds gold to current balance', () => {
      useCosmeticsStore.setState({ gold: 100 });
      useCosmeticsStore.getState().addGold(50);
      expect(useCosmeticsStore.getState().gold).toBe(150);
    });

    it('persists new balance to localStorage', () => {
      useCosmeticsStore.setState({ gold: 100 });
      useCosmeticsStore.getState().addGold(50);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.gold).toBe(150);
    });
  });

  describe('resetGoldForGuest', () => {
    it('resets gold to zero', () => {
      useCosmeticsStore.setState({ gold: 300 });
      useCosmeticsStore.getState().resetGoldForGuest();
      expect(useCosmeticsStore.getState().gold).toBe(0);
    });

    it('persists zero gold to localStorage', () => {
      useCosmeticsStore.setState({ gold: 300 });
      useCosmeticsStore.getState().resetGoldForGuest();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.gold).toBe(0);
    });

    it('does not clear owned items', () => {
      useCosmeticsStore.setState({ gold: 300, owned: new Set(['default', 'skull_skin']) });
      useCosmeticsStore.getState().resetGoldForGuest();
      expect(useCosmeticsStore.getState().owned.has('skull_skin')).toBe(true);
    });
  });
});
