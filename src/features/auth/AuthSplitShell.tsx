import { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { space, useTheme } from '../../theme';

const { width: WIN_W } = Dimensions.get('window');
const CURVE_OVERLAP = 18;

export type AuthSplitShellProps = {
  children: React.ReactNode;
  /** Fraction of window height for hero band (default 0.38). */
  heroHeightFraction?: number;
  /** When false, hero shows only the character mark (e.g. welcome hub titles live in navy panel). */
  showBrandInHero?: boolean;
};

export function AuthSplitShell({
  children,
  heroHeightFraction = 0.38,
  showBrandInHero = true,
}: AuthSplitShellProps) {
  const t = useTheme();
  const { t: tx } = useTranslation();
  const heroH = useMemo(() => {
    const h = Dimensions.get('window').height;
    return Math.max(180, Math.round(h * heroHeightFraction));
  }, [heroHeightFraction]);

  const curveW = WIN_W;
  const curveH = 28;
  const pathD = `M0,${curveH} Q ${curveW / 2},2 ${curveW},${curveH} L${curveW},${curveH + 6} L0,${curveH + 6} Z`;

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      <View style={[styles.hero, { height: heroH }]}>
        <LinearGradient
          colors={[t.surfaceAlt, t.surface, t.bg]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.heroInner}>
          {showBrandInHero ? (
            <View style={styles.brandBlock}>
              <Text style={[styles.appName, { color: t.text }]}>{tx('auth.brand.name')}</Text>
              <Text style={[styles.tagline, { color: t.textSecondary }]}>{tx('auth.brand.tagline')}</Text>
            </View>
          ) : (
            <View style={styles.heroSpacer} />
          )}
          <View
            style={[styles.iconOuter, { backgroundColor: t.surfaceAlt, borderColor: t.border }]}
            accessibilityLabel={tx('auth.brand.markLabel')}
          >
            <Image
              source={require('../../../assets/app_icon_no_background.png')}
              style={styles.icon}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </View>
        </View>
      </View>

      <View style={[styles.formShell, { backgroundColor: t.bg }]}>
        <Svg width={curveW} height={curveH + 6} style={styles.curveSvg} pointerEvents="none">
          <Path d={pathD} fill={t.bg} />
        </Svg>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    justifyContent: 'flex-end',
    paddingBottom: space[4],
  },
  heroInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: space[5],
  },
  heroSpacer: {
    height: space[2],
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: space[4],
    gap: space[1],
  },
  appName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    textAlign: 'center',
  },
  iconOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 64,
    height: 64,
  },
  formShell: {
    flex: 1,
    marginTop: -CURVE_OVERLAP,
  },
  curveSvg: {
    position: 'absolute',
    top: -CURVE_OVERLAP,
    left: 0,
    right: 0,
  },
});
