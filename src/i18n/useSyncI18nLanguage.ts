import { useEffect } from 'react';
import * as Localization from 'expo-localization';
import { useLocaleStore } from '../store/locale';
import { i18n } from './i18n';
import { resolveI18nLanguage } from './resolveI18nLanguage';

/** Keeps i18next in sync with persisted preference + device locales (System). */
export function useSyncI18nLanguage(): void {
  const languagePreference = useLocaleStore((s) => s.languagePreference);

  useEffect(() => {
    const tags = Localization.getLocales().map((l) => l.languageTag);
    const lng = resolveI18nLanguage(languagePreference, tags);
    void i18n.changeLanguage(lng);
  }, [languagePreference]);
}
