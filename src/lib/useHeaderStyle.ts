import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function useHeaderPadding() {
  const insets = useSafeAreaInsets();
  return { paddingTop: insets.top + 12 };
}
