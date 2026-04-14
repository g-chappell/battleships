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
    data: unknown;
    constructor(message: string, status = 400, data?: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  },
}));

import { useClanStore } from '../store/clanStore';
import { apiFetch, apiFetchSafe } from '../services/apiClient';
import type { ClanSummary, ClanDetail, ClanChatMessageType } from '@shared/index';

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
const mockApiFetchSafe = apiFetchSafe as ReturnType<typeof vi.fn>;

// --- Factory helpers ---

function makeClanSummary(overrides: Partial<ClanSummary> = {}): ClanSummary {
  return {
    id: 'clan-1',
    name: 'Iron Fleet',
    tag: 'IF',
    description: 'Best pirate clan',
    memberCount: 5,
    totalWins: 20,
    totalLosses: 8,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeClanDetail(overrides: Partial<ClanDetail> = {}): ClanDetail {
  return {
    ...makeClanSummary(),
    members: [],
    recentChat: [],
    ...overrides,
  };
}

function makeChatMessage(overrides: Partial<ClanChatMessageType> = {}): ClanChatMessageType {
  return {
    id: 'msg-1',
    clanId: 'clan-1',
    userId: 'user-1',
    username: 'pirate',
    text: 'Ahoy!',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// --- Tests ---

describe('clanStore', () => {
  beforeEach(() => {
    useClanStore.setState({
      myClanId: null,
      myClan: null,
      browse: [],
      leaderboard: [],
      chatMessages: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useClanStore.getState();
    expect(state.myClanId).toBeNull();
    expect(state.myClan).toBeNull();
    expect(state.browse).toEqual([]);
    expect(state.leaderboard).toEqual([]);
    expect(state.chatMessages).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // fetchBrowse
  // ---------------------------------------------------------------------------

  describe('fetchBrowse', () => {
    it('sets browse list on success', async () => {
      const clans = [makeClanSummary(), makeClanSummary({ id: 'clan-2', name: 'Sea Dogs' })];
      mockApiFetchSafe.mockResolvedValueOnce({ clans });

      await useClanStore.getState().fetchBrowse();

      expect(useClanStore.getState().browse).toEqual(clans);
      expect(useClanStore.getState().loading).toBe(false);
      expect(useClanStore.getState().error).toBeNull();
    });

    it('sets empty browse when response has no clans field', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({});

      await useClanStore.getState().fetchBrowse();

      expect(useClanStore.getState().browse).toEqual([]);
    });

    it('sets error to "Offline" when apiFetchSafe returns null', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useClanStore.getState().fetchBrowse();

      expect(useClanStore.getState().error).toBe('Offline');
      expect(useClanStore.getState().loading).toBe(false);
    });

    it('appends search query param when search is provided', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ clans: [] });

      await useClanStore.getState().fetchBrowse('pirates');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/clans?search=pirates');
    });

    it('calls /clans without query string when no search', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ clans: [] });

      await useClanStore.getState().fetchBrowse();

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/clans');
    });

    it('URL-encodes the search query', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ clans: [] });

      await useClanStore.getState().fetchBrowse('iron fleet');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/clans?search=iron%20fleet');
    });

    it('sets loading to false after failure', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useClanStore.getState().fetchBrowse();

      expect(useClanStore.getState().loading).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // fetchLeaderboard
  // ---------------------------------------------------------------------------

  describe('fetchLeaderboard', () => {
    it('sets leaderboard list on success', async () => {
      const clans = [makeClanSummary({ totalWins: 100 })];
      mockApiFetchSafe.mockResolvedValueOnce({ clans });

      await useClanStore.getState().fetchLeaderboard();

      expect(useClanStore.getState().leaderboard).toEqual(clans);
    });

    it('does not update leaderboard when response is null', async () => {
      useClanStore.setState({ leaderboard: [makeClanSummary()] });
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useClanStore.getState().fetchLeaderboard();

      expect(useClanStore.getState().leaderboard).toHaveLength(1);
    });

    it('sets empty leaderboard when response has no clans field', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({});

      await useClanStore.getState().fetchLeaderboard();

      expect(useClanStore.getState().leaderboard).toEqual([]);
    });

    it('calls the correct endpoint', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ clans: [] });

      await useClanStore.getState().fetchLeaderboard();

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/clans/leaderboard');
    });
  });

  // ---------------------------------------------------------------------------
  // fetchMyClan
  // ---------------------------------------------------------------------------

  describe('fetchMyClan', () => {
    it('sets myClan, myClanId, and chatMessages on success', async () => {
      const chat = [makeChatMessage()];
      const clan = makeClanDetail({ id: 'clan-1', recentChat: chat });
      mockApiFetchSafe.mockResolvedValueOnce({ clan: { ...clan, recentChat: chat } });

      await useClanStore.getState().fetchMyClan('clan-1');

      const state = useClanStore.getState();
      expect(state.myClanId).toBe('clan-1');
      expect(state.myClan).toMatchObject({ id: 'clan-1' });
      expect(state.chatMessages).toEqual(chat);
      expect(state.loading).toBe(false);
    });

    it('sets chatMessages to empty array when recentChat is missing', async () => {
      const clan = makeClanDetail();
      mockApiFetchSafe.mockResolvedValueOnce({ clan });

      await useClanStore.getState().fetchMyClan('clan-1');

      expect(useClanStore.getState().chatMessages).toEqual([]);
    });

    it('does not update state when response is null', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useClanStore.getState().fetchMyClan('clan-1');

      expect(useClanStore.getState().myClan).toBeNull();
      expect(useClanStore.getState().loading).toBe(false);
    });

    it('calls the correct endpoint', async () => {
      mockApiFetchSafe.mockResolvedValueOnce({ clan: makeClanDetail() });

      await useClanStore.getState().fetchMyClan('clan-42');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/clans/clan-42');
    });
  });

  // ---------------------------------------------------------------------------
  // createClan
  // ---------------------------------------------------------------------------

  describe('createClan', () => {
    it('returns { ok: true } and sets myClanId on success', async () => {
      mockApiFetch.mockResolvedValueOnce({ clanId: 'new-clan' });
      // fetchMyClan call after createClan
      mockApiFetchSafe.mockResolvedValueOnce({ clan: makeClanDetail({ id: 'new-clan' }) });

      const result = await useClanStore.getState().createClan('Iron Fleet', 'IF', 'A great clan', 'token123');

      expect(result).toEqual({ ok: true });
      expect(useClanStore.getState().myClanId).toBe('new-clan');
    });

    it('calls correct endpoint with POST and token', async () => {
      mockApiFetch.mockResolvedValueOnce({ clanId: 'new-clan' });
      mockApiFetchSafe.mockResolvedValueOnce({ clan: makeClanDetail({ id: 'new-clan' }) });

      await useClanStore.getState().createClan('Iron Fleet', 'IF', 'Desc', 'token123');

      expect(mockApiFetch).toHaveBeenCalledWith('/clans', expect.objectContaining({
        method: 'POST',
        token: 'token123',
        json: { name: 'Iron Fleet', tag: 'IF', description: 'Desc' },
      }));
    });

    it('returns { error } on ApiError', async () => {
      const { ApiError } = await import('../services/apiClient');
      mockApiFetch.mockRejectedValueOnce(new ApiError('Name already taken', 409, undefined));

      const result = await useClanStore.getState().createClan('Iron Fleet', 'IF', undefined, 'token123');

      expect(result).toEqual({ error: 'Name already taken' });
    });

    it('returns generic error message on non-ApiError', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await useClanStore.getState().createClan('Iron Fleet', 'IF', undefined, 'token123');

      expect(result).toEqual({ error: 'Clans unavailable offline' });
    });

    it('fetches clan detail after successful creation', async () => {
      mockApiFetch.mockResolvedValueOnce({ clanId: 'new-clan' });
      const clanDetail = makeClanDetail({ id: 'new-clan' });
      mockApiFetchSafe.mockResolvedValueOnce({ clan: clanDetail });

      await useClanStore.getState().createClan('Iron Fleet', 'IF', undefined, 'token123');

      expect(useClanStore.getState().myClan).toMatchObject({ id: 'new-clan' });
    });
  });

  // ---------------------------------------------------------------------------
  // joinClan
  // ---------------------------------------------------------------------------

  describe('joinClan', () => {
    it('returns { ok: true } and sets myClanId on success', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      mockApiFetchSafe.mockResolvedValueOnce({ clan: makeClanDetail({ id: 'clan-99' }) });

      const result = await useClanStore.getState().joinClan('clan-99', 'token123');

      expect(result).toEqual({ ok: true });
      expect(useClanStore.getState().myClanId).toBe('clan-99');
    });

    it('calls the correct endpoint with POST and token', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      mockApiFetchSafe.mockResolvedValueOnce({ clan: makeClanDetail({ id: 'clan-99' }) });

      await useClanStore.getState().joinClan('clan-99', 'tok');

      expect(mockApiFetch).toHaveBeenCalledWith('/clans/clan-99/join', expect.objectContaining({
        method: 'POST',
        token: 'tok',
      }));
    });

    it('returns { error } on ApiError', async () => {
      const { ApiError } = await import('../services/apiClient');
      mockApiFetch.mockRejectedValueOnce(new ApiError('Clan is full', 400, undefined));

      const result = await useClanStore.getState().joinClan('clan-99', 'token123');

      expect(result).toEqual({ error: 'Clan is full' });
    });

    it('returns generic error message on non-ApiError', async () => {
      mockApiFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await useClanStore.getState().joinClan('clan-99', 'token123');

      expect(result).toEqual({ error: 'Clans unavailable offline' });
    });

    it('fetches clan detail after successful join', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      const clanDetail = makeClanDetail({ id: 'clan-99' });
      mockApiFetchSafe.mockResolvedValueOnce({ clan: clanDetail });

      await useClanStore.getState().joinClan('clan-99', 'token123');

      expect(useClanStore.getState().myClan).toMatchObject({ id: 'clan-99' });
    });
  });

  // ---------------------------------------------------------------------------
  // leaveClan
  // ---------------------------------------------------------------------------

  describe('leaveClan', () => {
    it('clears myClan, myClanId, and chatMessages', async () => {
      useClanStore.setState({
        myClanId: 'clan-1',
        myClan: makeClanDetail(),
        chatMessages: [makeChatMessage()],
      });
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useClanStore.getState().leaveClan('token123');

      const state = useClanStore.getState();
      expect(state.myClan).toBeNull();
      expect(state.myClanId).toBeNull();
      expect(state.chatMessages).toEqual([]);
    });

    it('calls the correct endpoint with POST and token', async () => {
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useClanStore.getState().leaveClan('token123');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/clans/leave', expect.objectContaining({
        method: 'POST',
        token: 'token123',
      }));
    });
  });

  // ---------------------------------------------------------------------------
  // sendChat
  // ---------------------------------------------------------------------------

  describe('sendChat', () => {
    it('calls the correct endpoint with clanId, text, and token', async () => {
      useClanStore.setState({ myClanId: 'clan-1' });
      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useClanStore.getState().sendChat('Ahoy!', 'token123');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/clans/clan-1/chat', expect.objectContaining({
        method: 'POST',
        token: 'token123',
        json: { text: 'Ahoy!' },
      }));
    });

    it('does nothing when myClanId is null', async () => {
      useClanStore.setState({ myClanId: null });

      await useClanStore.getState().sendChat('Ahoy!', 'token123');

      expect(mockApiFetchSafe).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // appendChatFromSocket
  // ---------------------------------------------------------------------------

  describe('appendChatFromSocket', () => {
    it('appends a message to chatMessages', () => {
      const msg = makeChatMessage({ id: 'msg-new', text: 'Ahoy!' });

      useClanStore.getState().appendChatFromSocket(msg);

      expect(useClanStore.getState().chatMessages).toHaveLength(1);
      expect(useClanStore.getState().chatMessages[0]).toEqual(msg);
    });

    it('appends after existing messages', () => {
      const existing = makeChatMessage({ id: 'msg-1' });
      const incoming = makeChatMessage({ id: 'msg-2', text: 'Aye!' });
      useClanStore.setState({ chatMessages: [existing] });

      useClanStore.getState().appendChatFromSocket(incoming);

      const msgs = useClanStore.getState().chatMessages;
      expect(msgs).toHaveLength(2);
      expect(msgs[1]).toEqual(incoming);
    });

    it('caps chatMessages at 50 entries', () => {
      const existing = Array.from({ length: 50 }, (_, i) =>
        makeChatMessage({ id: `msg-${i}`, text: `msg ${i}` })
      );
      useClanStore.setState({ chatMessages: existing });

      const overflow = makeChatMessage({ id: 'msg-overflow', text: 'overflow' });
      useClanStore.getState().appendChatFromSocket(overflow);

      const msgs = useClanStore.getState().chatMessages;
      expect(msgs).toHaveLength(50);
      expect(msgs[msgs.length - 1]).toEqual(overflow);
      // oldest message was evicted
      expect(msgs[0].id).toBe('msg-1');
    });

    it('does not evict messages when under the 50-message cap', () => {
      const existing = Array.from({ length: 10 }, (_, i) =>
        makeChatMessage({ id: `msg-${i}` })
      );
      useClanStore.setState({ chatMessages: existing });

      useClanStore.getState().appendChatFromSocket(makeChatMessage({ id: 'new' }));

      expect(useClanStore.getState().chatMessages).toHaveLength(11);
    });
  });
});
