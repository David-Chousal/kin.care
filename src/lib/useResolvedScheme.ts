import { useColorScheme } from 'react-native';
import { useThemeStore } from '../store/theme';

export function useResolvedScheme(): 'light' | 'dark' {
  const preference = useThemeStore((s) => s.colorScheme);
  const systemScheme = useColorScheme();
  const resolved = preference === 'system' ? (systemScheme ?? 'light') : preference;
  return resolved === 'dark' ? 'dark' : 'light';
}
