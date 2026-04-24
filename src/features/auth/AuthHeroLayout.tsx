import { StyleSheet, ScrollView, type ScrollViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../../theme';
import { AuthSplitShell } from './AuthSplitShell';

type Props = {
  children: React.ReactNode;
  scrollViewProps?: Omit<ScrollViewProps, 'children' | 'style' | 'contentContainerStyle'>;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
  /** Smaller hero gives more vertical room for dense forms (e.g. sign-up step 1). */
  heroHeightFraction?: number;
};

export function AuthHeroLayout({
  children,
  scrollViewProps,
  contentContainerStyle,
  heroHeightFraction = 0.38,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <AuthSplitShell heroHeightFraction={heroHeightFraction} showBrandInHero>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollInner,
          { paddingBottom: insets.bottom + space[6] },
          contentContainerStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        {...scrollViewProps}
      >
        {children}
      </ScrollView>
    </AuthSplitShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollInner: {
    flexGrow: 1,
    paddingHorizontal: space[5],
    paddingTop: space[2],
  },
});
