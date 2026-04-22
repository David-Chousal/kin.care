import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LanguagePreference } from '../i18n/appLocales';

interface LocaleState {
  languagePreference: LanguagePreference;
  setLanguagePreference: (preference: LanguagePreference) => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      languagePreference: 'system',
      setLanguagePreference: (languagePreference) => set({ languagePreference }),
    }),
    {
      name: 'kin-locale',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
