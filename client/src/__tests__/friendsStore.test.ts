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

import { useFriendsStore, type Friend, type PendingRequest } from '../store/friendsStore';
import { apiFetch, apiFetchSafe } from '../services/apiClient';

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;
const mockApiFetchSafe = apiFetchSafe as ReturnType<typeof vi.fn>;

// --- Factory helpers ---

function makeFriend(overrides: Partial<Friend> = {}): Friend {
  return {
    id: 'friend-1',
    username: 'piratemate',
    online: true,
    rating: 1200,
    addedAt: 1000000,
    ...overrides,
  };
}

function makePendingRequest(overrides: Partial<PendingRequest> = {}): PendingRequest {
  return {
    id: 'req-1',
    fromUsername: 'stranger',
    fromId: 'user-99',
    createdAt: 1000000,
    ...overrides,
  };
}

// --- Tests ---

describe('friendsStore', () => {
  beforeEach(() => {
    useFriendsStore.setState({
      friends: [],
      pendingIncoming: [],
      pendingOutgoing: [],
      searchQuery: '',
      searchResults: [],
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('has correct initial state', () => {
    const state = useFriendsStore.getState();
    expect(state.friends).toEqual([]);
    expect(state.pendingIncoming).toEqual([]);
    expect(state.pendingOutgoing).toEqual([]);
    expect(state.searchQuery).toBe('');
    expect(state.searchResults).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // loadLocal
  // ---------------------------------------------------------------------------

  describe('loadLocal', () => {
    it('loads friends and pending arrays from localStorage', () => {
      const friend = makeFriend();
      const incoming = makePendingRequest({ id: 'req-in' });
      const outgoing = makePendingRequest({ id: 'req-out' });
      localStorage.setItem('battleships_friends', JSON.stringify({
        friends: [friend],
        pendingIncoming: [incoming],
        pendingOutgoing: [outgoing],
      }));

      useFriendsStore.getState().loadLocal();
      const state = useFriendsStore.getState();

      expect(state.friends).toEqual([friend]);
      expect(state.pendingIncoming).toEqual([incoming]);
      expect(state.pendingOutgoing).toEqual([outgoing]);
    });

    it('does nothing when localStorage has no entry', () => {
      useFriendsStore.getState().loadLocal();
      const state = useFriendsStore.getState();
      expect(state.friends).toEqual([]);
      expect(state.pendingIncoming).toEqual([]);
      expect(state.pendingOutgoing).toEqual([]);
    });

    it('defaults missing fields to empty arrays', () => {
      localStorage.setItem('battleships_friends', JSON.stringify({
        friends: [makeFriend()],
        // pendingIncoming and pendingOutgoing missing
      }));

      useFriendsStore.getState().loadLocal();
      const state = useFriendsStore.getState();

      expect(state.friends).toHaveLength(1);
      expect(state.pendingIncoming).toEqual([]);
      expect(state.pendingOutgoing).toEqual([]);
    });

    it('handles corrupt localStorage data without throwing', () => {
      localStorage.setItem('battleships_friends', 'not-valid-json');
      expect(() => useFriendsStore.getState().loadLocal()).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // loadFromServer
  // ---------------------------------------------------------------------------

  describe('loadFromServer', () => {
    it('sets friends and pending when both API calls succeed', async () => {
      const friend = makeFriend();
      const incoming = makePendingRequest({ id: 'req-in' });
      const outgoing = makePendingRequest({ id: 'req-out' });

      mockApiFetchSafe
        .mockResolvedValueOnce({ friends: [friend] })
        .mockResolvedValueOnce({ incoming: [incoming], outgoing: [outgoing] });

      await useFriendsStore.getState().loadFromServer('token123');
      const state = useFriendsStore.getState();

      expect(state.friends).toEqual([friend]);
      expect(state.pendingIncoming).toEqual([incoming]);
      expect(state.pendingOutgoing).toEqual([outgoing]);
    });

    it('falls back to localStorage when friends call returns null', async () => {
      const friend = makeFriend();
      localStorage.setItem('battleships_friends', JSON.stringify({
        friends: [friend], pendingIncoming: [], pendingOutgoing: [],
      }));

      mockApiFetchSafe
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ incoming: [], outgoing: [] });

      await useFriendsStore.getState().loadFromServer('token123');

      expect(useFriendsStore.getState().friends).toEqual([friend]);
    });

    it('falls back to localStorage when pending call returns null', async () => {
      const friend = makeFriend();
      localStorage.setItem('battleships_friends', JSON.stringify({
        friends: [friend], pendingIncoming: [], pendingOutgoing: [],
      }));

      mockApiFetchSafe
        .mockResolvedValueOnce({ friends: [] })
        .mockResolvedValueOnce(null);

      await useFriendsStore.getState().loadFromServer('token123');

      expect(useFriendsStore.getState().friends).toEqual([friend]);
    });

    it('uses empty arrays when API response omits array fields', async () => {
      mockApiFetchSafe
        .mockResolvedValueOnce({}) // no 'friends' key
        .mockResolvedValueOnce({}); // no 'incoming'/'outgoing' keys

      await useFriendsStore.getState().loadFromServer('token123');
      const state = useFriendsStore.getState();

      expect(state.friends).toEqual([]);
      expect(state.pendingIncoming).toEqual([]);
      expect(state.pendingOutgoing).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // sendRequest
  // ---------------------------------------------------------------------------

  describe('sendRequest', () => {
    it('returns error when username is blank', async () => {
      const result = await useFriendsStore.getState().sendRequest('   ');
      expect(result).toEqual({ ok: false, error: 'Enter a username' });
      expect(mockApiFetch).not.toHaveBeenCalled();
    });

    it('returns ok:true and refreshes from server on success', async () => {
      mockApiFetch.mockResolvedValueOnce({});
      mockApiFetchSafe
        .mockResolvedValueOnce({ friends: [] })
        .mockResolvedValueOnce({ incoming: [], outgoing: [] });

      const result = await useFriendsStore.getState().sendRequest('newmate', 'token123');

      expect(result).toEqual({ ok: true });
      expect(mockApiFetch).toHaveBeenCalledWith('/friends/request', expect.objectContaining({
        method: 'POST',
        token: 'token123',
        json: { username: 'newmate' },
      }));
    });

    it('returns error with message on 404 from server', async () => {
      const { ApiError } = await import('../services/apiClient');
      const err = new ApiError('User not found', 404, undefined);
      mockApiFetch.mockRejectedValueOnce(err);

      const result = await useFriendsStore.getState().sendRequest('ghost', 'token123');

      expect(result).toEqual({ ok: false, error: 'User not found' });
      expect(useFriendsStore.getState().pendingOutgoing).toHaveLength(0);
    });

    it('falls through to local fallback on non-404 server error', async () => {
      const { ApiError } = await import('../services/apiClient');
      const err = new ApiError('Server error', 500, undefined);
      mockApiFetch.mockRejectedValueOnce(err);

      const result = await useFriendsStore.getState().sendRequest('someone', 'token123');

      expect(result.ok).toBe(true);
      const state = useFriendsStore.getState();
      expect(state.pendingOutgoing).toHaveLength(1);
      expect(state.pendingOutgoing[0].fromUsername).toBe('someone');
    });

    it('uses local fallback with no token and does not call apiFetch', async () => {
      const result = await useFriendsStore.getState().sendRequest('localmate');

      expect(result.ok).toBe(true);
      expect(mockApiFetch).not.toHaveBeenCalled();
      const state = useFriendsStore.getState();
      expect(state.pendingOutgoing).toHaveLength(1);
      expect(state.pendingOutgoing[0].fromUsername).toBe('localmate');
    });

    it('local fallback saves outgoing request to localStorage', async () => {
      await useFriendsStore.getState().sendRequest('localmate');

      const stored = JSON.parse(localStorage.getItem('battleships_friends') ?? '{}');
      expect(stored.pendingOutgoing).toHaveLength(1);
    });

    it('local fallback generates unique IDs for multiple requests', async () => {
      await useFriendsStore.getState().sendRequest('userA');
      await useFriendsStore.getState().sendRequest('userB');

      const state = useFriendsStore.getState();
      expect(state.pendingOutgoing).toHaveLength(2);
      expect(state.pendingOutgoing[0].id).not.toBe(state.pendingOutgoing[1].id);
    });
  });

  // ---------------------------------------------------------------------------
  // acceptRequest
  // ---------------------------------------------------------------------------

  describe('acceptRequest', () => {
    it('calls server endpoint and refreshes state on success', async () => {
      const friend = makeFriend({ id: 'user-99', username: 'stranger' });
      mockApiFetchSafe
        .mockResolvedValueOnce({}) // accept call
        .mockResolvedValueOnce({ friends: [friend] }) // loadFromServer: list
        .mockResolvedValueOnce({ incoming: [], outgoing: [] }); // loadFromServer: pending

      await useFriendsStore.getState().acceptRequest('req-1', 'token123');

      expect(useFriendsStore.getState().friends).toEqual([friend]);
      expect(mockApiFetchSafe).toHaveBeenCalledWith('/friends/accept', expect.objectContaining({
        method: 'POST',
        token: 'token123',
        json: { requestId: 'req-1' },
      }));
    });

    it('falls back to local state when server accept returns null', async () => {
      const req = makePendingRequest({ id: 'req-1', fromId: 'user-99', fromUsername: 'stranger' });
      useFriendsStore.setState({ pendingIncoming: [req] });

      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useFriendsStore.getState().acceptRequest('req-1', 'token123');
      const state = useFriendsStore.getState();

      expect(state.friends).toHaveLength(1);
      expect(state.friends[0].id).toBe('user-99');
      expect(state.pendingIncoming).toHaveLength(0);
    });

    it('uses local fallback when no token provided', async () => {
      const req = makePendingRequest({ id: 'req-1', fromId: 'user-99', fromUsername: 'stranger' });
      useFriendsStore.setState({ pendingIncoming: [req] });

      await useFriendsStore.getState().acceptRequest('req-1');

      expect(mockApiFetchSafe).not.toHaveBeenCalled();
      const state = useFriendsStore.getState();
      expect(state.friends).toHaveLength(1);
      expect(state.pendingIncoming).toHaveLength(0);
    });

    it('saves accepted friend to localStorage', async () => {
      const req = makePendingRequest({ id: 'req-1' });
      useFriendsStore.setState({ pendingIncoming: [req] });

      await useFriendsStore.getState().acceptRequest('req-1');

      const stored = JSON.parse(localStorage.getItem('battleships_friends') ?? '{}');
      expect(stored.friends).toHaveLength(1);
    });

    it('does nothing in local fallback when request ID not found', async () => {
      useFriendsStore.setState({ pendingIncoming: [makePendingRequest({ id: 'req-1' })] });

      await useFriendsStore.getState().acceptRequest('nonexistent-id');

      const state = useFriendsStore.getState();
      expect(state.friends).toHaveLength(0);
      expect(state.pendingIncoming).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // declineRequest
  // ---------------------------------------------------------------------------

  describe('declineRequest', () => {
    it('calls server endpoint and refreshes on success', async () => {
      mockApiFetchSafe
        .mockResolvedValueOnce({}) // decline succeeds
        .mockResolvedValueOnce({ friends: [] })
        .mockResolvedValueOnce({ incoming: [], outgoing: [] });

      await useFriendsStore.getState().declineRequest('req-1', 'token123');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/friends/decline', expect.objectContaining({
        method: 'POST',
        token: 'token123',
        json: { requestId: 'req-1' },
      }));
    });

    it('removes request from local state when server call returns null', async () => {
      const req = makePendingRequest({ id: 'req-1' });
      useFriendsStore.setState({ pendingIncoming: [req] });

      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useFriendsStore.getState().declineRequest('req-1', 'token123');

      expect(useFriendsStore.getState().pendingIncoming).toHaveLength(0);
    });

    it('removes request locally when no token provided', async () => {
      const req1 = makePendingRequest({ id: 'req-1' });
      const req2 = makePendingRequest({ id: 'req-2' });
      useFriendsStore.setState({ pendingIncoming: [req1, req2] });

      await useFriendsStore.getState().declineRequest('req-1');

      expect(mockApiFetchSafe).not.toHaveBeenCalled();
      const state = useFriendsStore.getState();
      expect(state.pendingIncoming).toHaveLength(1);
      expect(state.pendingIncoming[0].id).toBe('req-2');
    });

    it('saves to localStorage after local decline', async () => {
      const req = makePendingRequest({ id: 'req-1' });
      useFriendsStore.setState({ pendingIncoming: [req] });

      await useFriendsStore.getState().declineRequest('req-1');

      const stored = JSON.parse(localStorage.getItem('battleships_friends') ?? '{}');
      expect(stored.pendingIncoming).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // removeFriend
  // ---------------------------------------------------------------------------

  describe('removeFriend', () => {
    it('calls server endpoint and refreshes on success', async () => {
      const friend = makeFriend({ id: 'friend-1' });
      useFriendsStore.setState({ friends: [friend] });

      mockApiFetchSafe
        .mockResolvedValueOnce({}) // delete succeeds
        .mockResolvedValueOnce({ friends: [] })
        .mockResolvedValueOnce({ incoming: [], outgoing: [] });

      await useFriendsStore.getState().removeFriend('friend-1', 'token123');

      expect(mockApiFetchSafe).toHaveBeenCalledWith('/friends/friend-1', expect.objectContaining({
        method: 'DELETE',
        token: 'token123',
      }));
    });

    it('removes friend from local state when server call returns null', async () => {
      const friend1 = makeFriend({ id: 'friend-1' });
      const friend2 = makeFriend({ id: 'friend-2' });
      useFriendsStore.setState({ friends: [friend1, friend2] });

      mockApiFetchSafe.mockResolvedValueOnce(null);

      await useFriendsStore.getState().removeFriend('friend-1', 'token123');
      const state = useFriendsStore.getState();

      expect(state.friends).toHaveLength(1);
      expect(state.friends[0].id).toBe('friend-2');
    });

    it('removes friend locally when no token provided', async () => {
      const friend1 = makeFriend({ id: 'friend-1' });
      const friend2 = makeFriend({ id: 'friend-2' });
      useFriendsStore.setState({ friends: [friend1, friend2] });

      await useFriendsStore.getState().removeFriend('friend-1');

      expect(mockApiFetchSafe).not.toHaveBeenCalled();
      const state = useFriendsStore.getState();
      expect(state.friends).toHaveLength(1);
      expect(state.friends[0].id).toBe('friend-2');
    });

    it('saves to localStorage after local remove', async () => {
      const friend = makeFriend({ id: 'friend-1' });
      useFriendsStore.setState({ friends: [friend] });

      await useFriendsStore.getState().removeFriend('friend-1');

      const stored = JSON.parse(localStorage.getItem('battleships_friends') ?? '{}');
      expect(stored.friends).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // setSearchQuery
  // ---------------------------------------------------------------------------

  describe('setSearchQuery', () => {
    it('updates searchQuery field', () => {
      useFriendsStore.getState().setSearchQuery('pirateX');
      expect(useFriendsStore.getState().searchQuery).toBe('pirateX');
    });

    it('clears searchQuery when set to empty string', () => {
      useFriendsStore.setState({ searchQuery: 'previous' });
      useFriendsStore.getState().setSearchQuery('');
      expect(useFriendsStore.getState().searchQuery).toBe('');
    });
  });
});
