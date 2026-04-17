import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock apiFetch before importing the store
vi.mock('../services/apiClient', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    data: unknown;
    constructor(message: string, status: number, data: unknown) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.data = data;
    }
  },
}));

import { useAuthStore } from '../store/authStore';
import { apiFetch } from '../services/apiClient';
import { ApiError } from '../services/apiClient';

const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

describe('authStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({ user: null, token: null, isLoading: false, error: null });
    // Clear localStorage
    localStorage.clear();
    // Reset mocks
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('login() sets user and token on success', async () => {
    const mockUser = { id: '1', email: 'test@test.com', username: 'tester' };
    mockApiFetch.mockResolvedValueOnce({ token: 'jwt-123', user: mockUser });

    const result = await useAuthStore.getState().login('test@test.com', 'password');

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-123');
    expect(state.user).toEqual(mockUser);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
    expect(localStorage.getItem('token')).toBe('jwt-123');
    expect(localStorage.getItem('user')).toBe(JSON.stringify(mockUser));
  });

  it('login() sets error on failure', async () => {
    mockApiFetch.mockRejectedValueOnce(new ApiError('Invalid credentials', 401, null));

    const result = await useAuthStore.getState().login('test@test.com', 'wrong');

    expect(result).toBe(false);
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('Invalid credentials');
  });

  it('register() sets user and token on success', async () => {
    const mockUser = { id: '2', email: 'new@test.com', username: 'newuser' };
    mockApiFetch.mockResolvedValueOnce({ token: 'jwt-456', user: mockUser });

    const result = await useAuthStore.getState().register('new@test.com', 'newuser', 'password', [
      { questionKey: 'first_pet', answer: 'Fluffy' },
      { questionKey: 'birth_city', answer: 'London' },
    ]);

    expect(result).toBe(true);
    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-456');
    expect(state.user).toEqual(mockUser);
    expect(localStorage.getItem('token')).toBe('jwt-456');
  });

  it('logout() clears auth state and localStorage', () => {
    // Set up authenticated state
    useAuthStore.setState({
      user: { id: '1', email: 'test@test.com', username: 'tester' },
      token: 'jwt-123',
    });
    localStorage.setItem('token', 'jwt-123');
    localStorage.setItem('user', '{"id":"1"}');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('loadFromStorage() restores auth from localStorage', () => {
    const mockUser = { id: '1', email: 'test@test.com', username: 'tester' };
    localStorage.setItem('token', 'jwt-saved');
    localStorage.setItem('user', JSON.stringify(mockUser));

    useAuthStore.getState().loadFromStorage();

    const state = useAuthStore.getState();
    expect(state.token).toBe('jwt-saved');
    expect(state.user).toEqual(mockUser);
  });

  it('clearError() clears the error', () => {
    useAuthStore.setState({ error: 'some error' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
