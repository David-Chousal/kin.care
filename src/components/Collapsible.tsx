import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Icon } from './Icon';

const DISCLOSURE_EASING = Easing.bezier(0.4, 0, 0.2, 1);
const DISCLOSURE_DURATION_MS = 280;

type CollapsibleProps = {
  expanded: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Collapsible({ expanded, children, style }: CollapsibleProps) {
  const [contentHeight, setContentHeight] = useState(0);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const hasSyncedInitial = useRef(false);

  const onContentLayout = (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    if (h <= 0) return;
    setContentHeight((prev) => (prev === h ? prev : h));
  };

  useEffect(() => {
    if (contentHeight === 0) return;

    if (!hasSyncedInitial.current) {
      hasSyncedInitial.current = true;
      heightAnim.setValue(expanded ? contentHeight : 0);
      return;
    }

    Animated.timing(heightAnim, {
      toValue: expanded ? contentHeight : 0,
      duration: DISCLOSURE_DURATION_MS,
      easing: DISCLOSURE_EASING,
      useNativeDriver: false,
    }).start();
  }, [expanded, contentHeight, heightAnim]);

  return createElement(
    Animated.View,
    { style: [style, { overflow: 'hidden', height: heightAnim }] },
    createElement(
      View,
      {
        style: {
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
        },
        onLayout: onContentLayout,
        collapsable: false,
      },
      children,
    ),
  );
}

type DisclosureChevronProps = {
  expanded: boolean;
  color: string;
  size?: number;
};

export function DisclosureChevron({ expanded, color, size = 18 }: DisclosureChevronProps) {
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: DISCLOSURE_DURATION_MS,
      easing: DISCLOSURE_EASING,
      useNativeDriver: true,
    }).start();
  }, [expanded, progress]);

  const rotate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return createElement(
    Animated.View,
    { style: { transform: [{ rotate }] } },
    createElement(Icon, { name: 'chevron', size, color }),
  );
}
