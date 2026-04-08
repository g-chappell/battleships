import { create } from 'zustand';
import { apiFetch, apiFetchSafe, ApiError } from '../services/apiClient';

const STORAGE_KEY = 'battleships_friends';

export interface Friend {
  id: string;
  username: string;
  online?: boolean;
  rating?: number;
  addedAt: number;
}

export interface PendingRequest {
  id: string;
  fromUsername: string;
  fromId: string;
  createdAt: number;
}

interface FriendsListResponse { friends?: Friend[] }
interface PendingResponse { incoming?: PendingRequest[]; outgoing?: PendingRequest[] }

interface FriendsStore {
  friends: Friend[];
  pendingIncoming: PendingRequest[];
  pendingOutgoing: PendingRequest[];
  searchQuery: string;
  searchResults: Friend[];

  loadLocal: () => void;
  loadFromServer: (token: string) => Promise<void>;
  sendRequest: (username: string, token?: string | null) => Promise<{ ok: boolean; error?: string }>;
  acceptRequest: (requestId: string, token?: string | null) => Promise<void>;
  declineRequest: (requestId: string, token?: string | null) => Promise<void>;
  removeFriend: (friendId: string, token?: string | null) => Promise<void>;
  setSearchQuery: (q: string) => void;
}

function saveLocal(state: { friends: Friend[]; pendingIncoming: PendingRequest[]; pendingOutgoing: PendingRequest[] }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export const useFriendsStore = create<FriendsStore>((set, get) => ({
  friends: [],
  pendingIncoming: [],
  pendingOutgoing: [],
  searchQuery: '',
  searchResults: [],

  loadLocal: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set({
          friends: data.friends ?? [],
          pendingIncoming: data.pendingIncoming ?? [],
          pendingOutgoing: data.pendingOutgoing ?? [],
        });
      }
    } catch {}
  },

  loadFromServer: async (token) => {
    const [friends, pending] = await Promise.all([
      apiFetchSafe<FriendsListResponse>('/friends/list', { token }),
      apiFetchSafe<PendingResponse>('/friends/pending', { token }),
    ]);
    if (friends && pending) {
      set({
        friends: friends.friends ?? [],
        pendingIncoming: pending.incoming ?? [],
        pendingOutgoing: pending.outgoing ?? [],
      });
    } else {
      get().loadLocal();
    }
  },

  sendRequest: async (username, token) => {
    if (!username.trim()) return { ok: false, error: 'Enter a username' };

    // Server-first attempt
    if (token) {
      try {
        await apiFetch('/friends/request', {
          method: 'POST',
          token,
          json: { username },
        });
        await get().loadFromServer(token);
        return { ok: true };
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return { ok: false, error: err.message || 'User not found' };
        }
        // Fall through to local
      }
    }

    // Local fallback: just add as a pending outgoing
    const newRequest: PendingRequest = {
      id: 'local_' + Math.random().toString(36).slice(2),
      fromUsername: username,
      fromId: 'local_' + username,
      createdAt: Date.now(),
    };
    set((s) => {
      const updated = { ...s, pendingOutgoing: [...s.pendingOutgoing, newRequest] };
      saveLocal(updated);
      return updated;
    });
    return { ok: true };
  },

  acceptRequest: async (requestId, token) => {
    if (token) {
      const ok = await apiFetchSafe('/friends/accept', {
        method: 'POST',
        token,
        json: { requestId },
      });
      if (ok !== null) {
        await get().loadFromServer(token);
        return;
      }
    }
    // Local fallback
    set((s) => {
      const req = s.pendingIncoming.find((r) => r.id === requestId);
      if (!req) return s;
      const newFriend: Friend = {
        id: req.fromId,
        username: req.fromUsername,
        addedAt: Date.now(),
      };
      const updated = {
        ...s,
        friends: [...s.friends, newFriend],
        pendingIncoming: s.pendingIncoming.filter((r) => r.id !== requestId),
      };
      saveLocal(updated);
      return updated;
    });
  },

  declineRequest: async (requestId, token) => {
    if (token) {
      const ok = await apiFetchSafe('/friends/decline', {
        method: 'POST',
        token,
        json: { requestId },
      });
      if (ok !== null) {
        await get().loadFromServer(token);
        return;
      }
    }
    set((s) => {
      const updated = {
        ...s,
        pendingIncoming: s.pendingIncoming.filter((r) => r.id !== requestId),
      };
      saveLocal(updated);
      return updated;
    });
  },

  removeFriend: async (friendId, token) => {
    if (token) {
      const ok = await apiFetchSafe(`/friends/${friendId}`, {
        method: 'DELETE',
        token,
      });
      if (ok !== null) {
        await get().loadFromServer(token);
        return;
      }
    }
    set((s) => {
      const updated = { ...s, friends: s.friends.filter((f) => f.id !== friendId) };
      saveLocal(updated);
      return updated;
    });
  },

  setSearchQuery: (q) => set({ searchQuery: q }),
}));
