import { StyleSheet, Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useResolvedScheme } from '../lib/useResolvedScheme';
import { useTheme } from '../theme';
import { GLASS_BLUR_INTENSITY, frostGlassFallbackFill, frostVeilColor, glassBlurPlatformProps } from '../theme/glass';
import { useGlassBlurPreferred } from '../navigation/useGlassBlurPreferred';

export type HeaderFrostedBackdropMode = 'auto' | 'blur' | 'fallback';

type Props = {
  /** Extra tint on top of blur for legibility (default on, matches floating promo). */
  veil?: boolean;
  /**
   * `auto` — blur when allowed (no a11y / web / force-fallback blocks).
   * `blur` — same as auto but ignores `GLASS_HEADER_FORCE_FALLBACK` (still respects motion/transparency).
   * `fallback` — never use live blur; glass-like solid fill + optional veil.
   */
  mode?: HeaderFrostedBackdropMode;
  /** Bottom hairline (e.g. native stack chrome). Avoid stacking with an outer border on the same edge. */
  bottomHairline?: boolean;
};

/** Frosted glass under headers, footers, and floating plates. */
export function HeaderFrostedBackdrop({
  veil = true,
  mode = 'auto',
  bottomHairline = false,
}: Props) {
  const t = useTheme();
  const resolvedScheme = useResolvedScheme();
  const blurTint = resolvedScheme === 'dark' ? 'dark' : 'light';
  const scheme = resolvedScheme === 'dark' ? 'dark' : 'light';

  const ignoreForceFallback = mode === 'blur';
  const glassBlurPreferred = useGlassBlurPreferred({ ignoreForceFallback });
  const useLiveBlur = mode !== 'fallback' && glassBlurPreferred;

  const shellStyle = [
    StyleSheet.absoluteFillObject,
    bottomHairline
      ? {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: t.border,
        }
      : null,
    Platform.OS === 'android' ? { elevation: useLiveBlur ? 2 : 3 } : null,
  ];

  return (
    <View style={shellStyle} pointerEvents="none">
      {useLiveBlur ? (
        <>
          <BlurView
            tint={blurTint}
            intensity={Platform.OS === 'ios' ? GLASS_BLUR_INTENSITY.ios : GLASS_BLUR_INTENSITY.android}
            {...glassBlurPlatformProps()}
            style={StyleSheet.absoluteFillObject}
          />
          {veil ? (
            <View
              style={[StyleSheet.absoluteFillObject, { backgroundColor: frostVeilColor(t, scheme) }]}
              pointerEvents="none"
            />
          ) : null}
        </>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: frostGlassFallbackFill(t, scheme),
            },
          ]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}
