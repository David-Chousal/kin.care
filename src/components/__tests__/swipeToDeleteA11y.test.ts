import en from '../../i18n/locales/en/translation.json';
import ja from '../../i18n/locales/ja/translation.json';
import zhHans from '../../i18n/locales/zh-Hans/translation.json';

function getHint(locale: any): string {
  return locale?.common?.a11y?.swipeToRevealDeleteHint ?? '';
}

describe('SwipeToDelete a11y hint', () => {
  it('exists for en/ja/zh-Hans', () => {
    expect(getHint(en)).toBeTruthy();
    expect(getHint(ja)).toBeTruthy();
    expect(getHint(zhHans)).toBeTruthy();
  });

  it('is short enough to avoid VoiceOver truncation', () => {
    expect(getHint(en).length).toBeLessThanOrEqual(40);
    expect(getHint(ja).length).toBeLessThanOrEqual(24);
    expect(getHint(zhHans).length).toBeLessThanOrEqual(24);
  });
});

