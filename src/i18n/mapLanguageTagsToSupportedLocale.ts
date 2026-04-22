import type { AppLocale } from './appLocales';

/**
 * Maps Expo / OS `languageTag` values (in priority order) to a supported app locale.
 * Unsupported regions fall back to base language (e.g. es-MX → es). Traditional Chinese
 * tags are skipped so a secondary locale (e.g. en) can be chosen instead of forcing Simplified.
 */
export function mapLanguageTagsToSupportedLocale(languageTags: readonly string[]): AppLocale {
  for (const raw of languageTags) {
    const tag = raw.toLowerCase().replace(/_/g, '-');
    if (tag === 'zh-hans' || tag === 'zh-cn' || tag === 'zh-sg') return 'zh-Hans';
    if (
      tag.startsWith('zh-hant') ||
      tag === 'zh-tw' ||
      tag === 'zh-hk' ||
      tag === 'zh-mo'
    ) {
      continue;
    }
    const primary = tag.split('-')[0] ?? '';
    if (primary === 'zh') return 'zh-Hans';
    if (primary === 'es') return 'es';
    if (primary === 'fr') return 'fr';
    if (primary === 'de') return 'de';
    if (primary === 'ja') return 'ja';
    if (primary === 'en') return 'en';
  }
  return 'en';
}
