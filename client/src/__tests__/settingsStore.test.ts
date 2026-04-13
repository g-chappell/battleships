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

import { useSettingsStore } from '../store/settingsStore';
import { setVolume, setMuted, setSfxVolume, setMusicVolume, startAmbientLoop, stopAmbientLoop } from '../services/audio';

const STORAGE_KEY = 'battleships_settings';

const mockSetVolume = setVolume as ReturnType<typeof vi.fn>;
const mockSetMuted = setMuted as ReturnType<typeof vi.fn>;
const mockSetSfxVolume = setSfxVolume as ReturnType<typeof vi.fn>;
const mockSetMusicVolume = setMusicVolume as ReturnType<typeof vi.fn>;
const mockStartAmbientLoop = startAmbientLoop as ReturnType<typeof vi.fn>;
const mockStopAmbientLoop = stopAmbientLoop as ReturnType<typeof vi.fn>;

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      masterVolume: 0.45,
      sfxVolume: 1.0,
      musicVolume: 0.6,
      muted: false,
      musicEnabled: true,
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('has correct initial state', () => {
    const state = useSettingsStore.getState();
    expect(state.masterVolume).toBe(0.45);
    expect(state.sfxVolume).toBe(1.0);
    expect(state.musicVolume).toBe(0.6);
    expect(state.muted).toBe(false);
    expect(state.musicEnabled).toBe(true);
  });

  describe('setMasterVolume', () => {
    it('updates masterVolume state', () => {
      useSettingsStore.getState().setMasterVolume(0.8);
      expect(useSettingsStore.getState().masterVolume).toBe(0.8);
    });

    it('calls audio setVolume', () => {
      useSettingsStore.getState().setMasterVolume(0.8);
      expect(mockSetVolume).toHaveBeenCalledWith(0.8);
    });

    it('persists to localStorage', () => {
      useSettingsStore.getState().setMasterVolume(0.8);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.masterVolume).toBe(0.8);
    });
  });

  describe('setSfxVolume', () => {
    it('updates sfxVolume state', () => {
      useSettingsStore.getState().setSfxVolume(0.5);
      expect(useSettingsStore.getState().sfxVolume).toBe(0.5);
    });

    it('calls audio setSfxVolume', () => {
      useSettingsStore.getState().setSfxVolume(0.5);
      expect(mockSetSfxVolume).toHaveBeenCalledWith(0.5);
    });

    it('persists to localStorage', () => {
      useSettingsStore.getState().setSfxVolume(0.5);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.sfxVolume).toBe(0.5);
    });
  });

  describe('setMusicVolume', () => {
    it('updates musicVolume state', () => {
      useSettingsStore.getState().setMusicVolume(0.3);
      expect(useSettingsStore.getState().musicVolume).toBe(0.3);
    });

    it('calls audio setMusicVolume', () => {
      useSettingsStore.getState().setMusicVolume(0.3);
      expect(mockSetMusicVolume).toHaveBeenCalledWith(0.3);
    });

    it('persists to localStorage', () => {
      useSettingsStore.getState().setMusicVolume(0.3);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.musicVolume).toBe(0.3);
    });
  });

  describe('toggleMuted', () => {
    it('toggles muted from false to true', () => {
      expect(useSettingsStore.getState().muted).toBe(false);
      useSettingsStore.getState().toggleMuted();
      expect(useSettingsStore.getState().muted).toBe(true);
    });

    it('toggles muted from true to false', () => {
      useSettingsStore.setState({ muted: true });
      useSettingsStore.getState().toggleMuted();
      expect(useSettingsStore.getState().muted).toBe(false);
    });

    it('calls audio setMuted with new value', () => {
      useSettingsStore.getState().toggleMuted();
      expect(mockSetMuted).toHaveBeenCalledWith(true);

      useSettingsStore.getState().toggleMuted();
      expect(mockSetMuted).toHaveBeenCalledWith(false);
    });

    it('persists to localStorage', () => {
      useSettingsStore.getState().toggleMuted();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.muted).toBe(true);
    });
  });

  describe('toggleMusic', () => {
    it('toggles musicEnabled from true to false', () => {
      expect(useSettingsStore.getState().musicEnabled).toBe(true);
      useSettingsStore.getState().toggleMusic();
      expect(useSettingsStore.getState().musicEnabled).toBe(false);
    });

    it('toggles musicEnabled from false to true', () => {
      useSettingsStore.setState({ musicEnabled: false });
      useSettingsStore.getState().toggleMusic();
      expect(useSettingsStore.getState().musicEnabled).toBe(true);
    });

    it('calls stopAmbientLoop when disabling music', () => {
      useSettingsStore.getState().toggleMusic();
      expect(mockStopAmbientLoop).toHaveBeenCalled();
      expect(mockStartAmbientLoop).not.toHaveBeenCalled();
    });

    it('calls startAmbientLoop when enabling music', () => {
      useSettingsStore.setState({ musicEnabled: false });
      useSettingsStore.getState().toggleMusic();
      expect(mockStartAmbientLoop).toHaveBeenCalled();
      expect(mockStopAmbientLoop).not.toHaveBeenCalled();
    });

    it('persists to localStorage', () => {
      useSettingsStore.getState().toggleMusic();
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
      expect(stored.musicEnabled).toBe(false);
    });
  });

  describe('loadFromStorage', () => {
    it('loads settings from localStorage', () => {
      const saved = { masterVolume: 0.9, sfxVolume: 0.7, musicVolume: 0.4, muted: true, musicEnabled: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      useSettingsStore.getState().loadFromStorage();

      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(0.9);
      expect(state.sfxVolume).toBe(0.7);
      expect(state.musicVolume).toBe(0.4);
      expect(state.muted).toBe(true);
      expect(state.musicEnabled).toBe(false);
    });

    it('calls audio functions with loaded values', () => {
      const saved = { masterVolume: 0.9, sfxVolume: 0.7, musicVolume: 0.4, muted: true, musicEnabled: false };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

      useSettingsStore.getState().loadFromStorage();

      expect(mockSetVolume).toHaveBeenCalledWith(0.9);
      expect(mockSetSfxVolume).toHaveBeenCalledWith(0.7);
      expect(mockSetMusicVolume).toHaveBeenCalledWith(0.4);
      expect(mockSetMuted).toHaveBeenCalledWith(true);
    });

    it('does nothing when localStorage is empty', () => {
      useSettingsStore.getState().loadFromStorage();
      // State should remain at defaults
      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(0.45);
      expect(mockSetVolume).not.toHaveBeenCalled();
    });

    it('uses default values for missing fields', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ masterVolume: 0.2 }));

      useSettingsStore.getState().loadFromStorage();

      expect(mockSetVolume).toHaveBeenCalledWith(0.2);
      expect(mockSetSfxVolume).toHaveBeenCalledWith(1.0);
      expect(mockSetMusicVolume).toHaveBeenCalledWith(0.6);
      expect(mockSetMuted).toHaveBeenCalledWith(false);
    });
  });
});
