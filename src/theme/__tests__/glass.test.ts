import type { Theme } from '../index';
import { frostGlassFallbackFill } from '../glass';

describe('glass theme helpers', () => {
  it('frostGlassFallbackFill appends alpha for 6-digit hex surfaces', () => {
    const t = { surface: '#112233' } as Theme;
    expect(frostGlassFallbackFill(t, 'light')).toBe('#112233EE');
    expect(frostGlassFallbackFill(t, 'dark')).toBe('#112233E6');
  });

  it('frostGlassFallbackFill returns surface when not #RRGGBB', () => {
    const t = { surface: 'rgb(0,0,0)' } as Theme;
    expect(frostGlassFallbackFill(t, 'light')).toBe('rgb(0,0,0)');
  });
});
