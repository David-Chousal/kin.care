/** BCP-47-ish codes used as i18next `lng` values and persisted explicit picks. */
export const APP_LOCALES = ['en', 'es', 'fr', 'de', 'ja', 'zh-Hans'] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export type LanguagePreference = 'system' | AppLocale;

export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value);
}
