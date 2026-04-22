import { mapLanguageTagsToSupportedLocale } from '../mapLanguageTagsToSupportedLocale';

describe('mapLanguageTagsToSupportedLocale', () => {
  it('maps Spanish regional tags to es', () => {
    expect(mapLanguageTagsToSupportedLocale(['es-MX'])).toBe('es');
    expect(mapLanguageTagsToSupportedLocale(['es-ES'])).toBe('es');
  });

  it('maps English variants to en', () => {
    expect(mapLanguageTagsToSupportedLocale(['en-GB'])).toBe('en');
    expect(mapLanguageTagsToSupportedLocale(['en-US'])).toBe('en');
  });

  it('maps Simplified Chinese tags to zh-Hans', () => {
    expect(mapLanguageTagsToSupportedLocale(['zh-Hans-CN'])).toBe('zh-Hans');
    expect(mapLanguageTagsToSupportedLocale(['zh-CN'])).toBe('zh-Hans');
    expect(mapLanguageTagsToSupportedLocale(['zh-SG'])).toBe('zh-Hans');
    expect(mapLanguageTagsToSupportedLocale(['zh'])).toBe('zh-Hans');
  });

  it('skips Traditional Chinese and uses the next tag', () => {
    expect(mapLanguageTagsToSupportedLocale(['zh-TW', 'en-US'])).toBe('en');
    expect(mapLanguageTagsToSupportedLocale(['zh-Hant-HK', 'fr-CA'])).toBe('fr');
  });

  it('falls back to en for unsupported languages', () => {
    expect(mapLanguageTagsToSupportedLocale(['xx-YY'])).toBe('en');
    expect(mapLanguageTagsToSupportedLocale([])).toBe('en');
  });

  it('maps ja and de', () => {
    expect(mapLanguageTagsToSupportedLocale(['ja-JP'])).toBe('ja');
    expect(mapLanguageTagsToSupportedLocale(['de-AT'])).toBe('de');
  });
});
