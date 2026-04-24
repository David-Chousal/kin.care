import { useEffect, useReducer } from 'react';
import { i18n } from './i18n';

/**
 * Subscribes to i18n language changes and bumps React state so parents re-render.
 * Use in navigators whose `screenOptions` / `options` closures would otherwise stay stale
 * (React Navigation does not always re-merge static `options` props when only i18n updates).
 */
export function useRerenderOnI18nLanguageChange(): void {
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const onLang = () => bump();
    i18n.on('languageChanged', onLang);
    return () => {
      i18n.off('languageChanged', onLang);
    };
  }, []);
}
