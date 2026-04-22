import type { AppLocale, LanguagePreference } from './appLocales';
import { mapLanguageTagsToSupportedLocale } from './mapLanguageTagsToSupportedLocale';

export function resolveI18nLanguage(
  preference: LanguagePreference,
  systemLanguageTags: readonly string[],
): AppLocale {
  if (preference !== 'system') return preference;
  return mapLanguageTagsToSupportedLocale(systemLanguageTags);
}
