import type { ReactNode } from 'react';
import { View, StyleSheet, Animated, Platform } from 'react-native';
import { HeaderFrostedBackdrop } from './HeaderFrostedBackdrop';
import { NAVIGATION_HEADER_CHROME_PAD, navigationFooterChromeHeight, spacing } from '../theme';

type Props = {
  chromeOpacity: Animated.Value;
  /** Blur strip height including safe-area (matches `navigationFooterChromeHeight`). */
  barHeight: number;
  borderColor: string;
  /** Safe-area bottom for padding inside the button row. */
  insetBottom: number;
  children: ReactNode;
};

/**
 * Fixed bottom frosted bar. Fades `chromeOpacity` on the blur + hairline only;
 * render controls in `children` so they stay fully opaque and tappable.
 */
export function BlurredFooterChrome({
  chromeOpacity,
  barHeight,
  borderColor,
  insetBottom,
  children,
}: Props) {
  return (
    <View style={[styles.host, { height: barHeight }]} pointerEvents="box-none">
      <Animated.View
        style={[styles.fadeLayer, { height: barHeight, opacity: chromeOpacity }]}
        pointerEvents="none"
      >
        <View style={[styles.bar, { height: barHeight, borderTopColor: borderColor }]}>
          <HeaderFrostedBackdrop />
        </View>
      </Animated.View>
      <View
        style={[
          styles.buttonHost,
          {
            height: barHeight,
            paddingTop: NAVIGATION_HEADER_CHROME_PAD,
            paddingBottom: insetBottom + NAVIGATION_HEADER_CHROME_PAD,
            paddingHorizontal: spacing.xl,
          },
        ]}
        pointerEvents="box-none"
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 25,
    ...Platform.select({
      android: { elevation: 12 },
      default: {},
    }),
  },
  fadeLayer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  buttonHost: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
});

export function homeFooterScrollPaddingBottom(insetBottom: number, extraGap = 8): number {
  return navigationFooterChromeHeight(insetBottom) + extraGap;
}
