import { create } from 'zustand';

import { secureKeyValueStore } from '../storage/secureStore';

export type ThemePreference = 'system' | 'light' | 'dark';
const KEY = 'dz24.themePreference';

interface UiState {
  themePreference: ThemePreference;
  hydrate: () => Promise<void>;
  setThemePreference: (p: ThemePreference) => Promise<void>;
}

/** Only small, transient UI state lives here; server data belongs to TanStack Query. */
export const useUiStore = create<UiState>((set) => ({
  themePreference: 'system',
  hydrate: async () => {
    try {
      const v = await secureKeyValueStore.getItem(KEY);
      if (v === 'light' || v === 'dark' || v === 'system') set({ themePreference: v });
    } catch {
      /* keep default */
    }
  },
  setThemePreference: async (p) => {
    set({ themePreference: p });
    try {
      await secureKeyValueStore.setItem(KEY, p);
    } catch {
      /* preference just won't persist */
    }
  },
}));
