import type { Theme } from '../index';
import { frostGlassFallbackFill } from '../glass';

describe('glass theme helpers', () => {
  it('frostGlassFallbackFill uses opaque surface for contrast-safe chrome', () => {
    const t = { surface: '#112233' } as Theme;
    expect(frostGlassFallbackFill(t, 'light')).toBe('#112233');
    expect(frostGlassFallbackFill(t, 'dark')).toBe('#112233');
  });

  it('frostGlassFallbackFill returns surface for non-hex tokens', () => {
    const t = { surface: 'rgb(0,0,0)' } as Theme;
    expect(frostGlassFallbackFill(t, 'light')).toBe('rgb(0,0,0)');
  });
});
