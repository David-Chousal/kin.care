import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorSchemePreference = 'light' | 'dark' | 'system';

interface ThemeState {
  colorScheme: ColorSchemePreference;
  setColorScheme: (scheme: ColorSchemePreference) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      colorScheme: 'dark',
      setColorScheme: (colorScheme) => set({ colorScheme }),
    }),
    {
      name: 'kin-theme',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
