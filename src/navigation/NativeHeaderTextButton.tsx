import { Pressable, Text, Platform, View } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  /** Use theme error color (e.g. destructive actions). */
  destructive?: boolean;
}

/**
 * Plain text bar action for `headerRight` (glass or opaque native header).
 *
 * Do **not** wrap in `flex: 1` (or other expanding layouts): inside
 * `ScreenStackHeaderRightView`, that makes iOS treat the whole trailing region as one
 * bar-item cluster and draw a single wide “capsule” (Liquid Glass / shared chrome) that
 * can cover the centered title. Shrink-wrapped `Pressable` only.
 *
 * The outer `View` keeps intrinsic width stable across layout passes (RN sometimes
 * hands the native bar a full-width flex region on the first pass after `setOptions`).
 */
export function NativeHeaderTextButton({ label, onPress, destructive }: Props) {
  const t = useTheme();
  const padH = Platform.OS === 'ios' ? 8 : 10;

  const outerStyle =
    Platform.OS === 'ios'
      ? {
          flexGrow: 0,
          flexShrink: 0,
          alignSelf: 'flex-start' as const,
        }
      : undefined;

  return (
    <View pointerEvents="box-none" collapsable={false} style={outerStyle}>
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
        style={({ pressed }) => ({
          opacity: pressed ? 0.65 : 1,
          paddingVertical: 6,
          paddingHorizontal: padH,
        })}
      >
        <Text
          numberOfLines={1}
          style={{
            fontSize: 17,
            fontWeight: '600',
            color: destructive ? t.error : t.accent,
          }}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}
