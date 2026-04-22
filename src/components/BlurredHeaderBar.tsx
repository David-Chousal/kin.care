import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { View, StyleSheet, Platform } from 'react-native';
import { HeaderFrostedBackdrop } from './HeaderFrostedBackdrop';

/**
 * Frosted header strip (blur + content). Uses the same `HeaderFrostedBackdrop` as native-stack
 * and `ScreenHeader` (blur or accessibility fallback).
 */
export function BlurredHeaderBar({
  children,
  style,
  contentStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.shell,
        Platform.select({
          android: { elevation: 4 },
          default: {},
        }),
        style,
      ]}
    >
      <HeaderFrostedBackdrop veil bottomHairline />
      <View style={[styles.front, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    overflow: 'hidden',
  },
  front: {
    position: 'relative',
    zIndex: 1,
  },
});
