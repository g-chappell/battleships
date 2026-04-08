import { create } from 'zustand';
import { setVolume, setMuted } from '../services/audio';

const STORAGE_KEY = 'battleships_settings';

interface SettingsStore {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
  musicEnabled: boolean;

  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  toggleMuted: () => void;
  toggleMusic: () => void;
  loadFromStorage: () => void;
}

function persist(state: { masterVolume: number; sfxVolume: number; musicVolume: number; muted: boolean; musicEnabled: boolean }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  masterVolume: 0.45,
  sfxVolume: 1.0,
  musicVolume: 0.6,
  muted: false,
  musicEnabled: true,

  setMasterVolume: (v) => {
    set({ masterVolume: v });
    setVolume(v);
    persist({ ...get(), masterVolume: v });
  },

  setSfxVolume: (v) => {
    set({ sfxVolume: v });
    persist({ ...get(), sfxVolume: v });
  },

  setMusicVolume: (v) => {
    set({ musicVolume: v });
    persist({ ...get(), musicVolume: v });
  },

  toggleMuted: () => {
    const muted = !get().muted;
    set({ muted });
    setMuted(muted);
    persist({ ...get(), muted });
  },

  toggleMusic: () => {
    const musicEnabled = !get().musicEnabled;
    set({ musicEnabled });
    persist({ ...get(), musicEnabled });
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        set(data);
        setVolume(data.masterVolume ?? 0.45);
        setMuted(data.muted ?? false);
      }
    } catch {}
  },
}));
