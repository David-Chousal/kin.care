/** BCP-47 tag for `Intl` / `toLocaleDateString` from active i18n language. */
export function getFormatLocaleTag(appLocale: string): string {
  switch (appLocale) {
    case 'zh-Hans':
      return 'zh-CN';
    case 'en':
      return 'en-US';
    case 'es':
      return 'es-419';
    case 'fr':
      return 'fr-FR';
    case 'de':
      return 'de-DE';
    case 'ja':
      return 'ja-JP';
    default:
      return 'en-US';
  }
}
