import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import type { Theme as AppTheme } from '../theme';

export function buildNavigationTheme(t: AppTheme, dark: boolean): NavigationTheme {
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.accent,
      background: t.bg,
      card: t.surface,
      text: t.text,
      border: t.border,
      notification: t.accent,
    },
  };
}
