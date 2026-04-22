import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { HeaderFrostedBackdrop } from '../components/HeaderFrostedBackdrop';

/** Native-stack `headerBackground` fill: frosted blur with bottom hairline (or a11y fallback). */
export const GlassNativeStackHeaderBackground = memo(function GlassNativeStackHeaderBackgroundView() {
  return (
    <View style={StyleSheet.absoluteFillObject}>
      <HeaderFrostedBackdrop veil bottomHairline />
    </View>
  );
});
