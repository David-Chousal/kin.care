import { useColorScheme, Platform, PixelRatio, type TextStyle, type ViewStyle } from 'react-native';
import { useThemeStore } from '../store/theme';

/* ─────────────────────────────────────────────────────────────
   Color tokens
   ───────────────────────────────────────────────────────────── */

export interface Theme {
  // Backgrounds
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceDim: string;
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  // Borders
  border: string;
  borderLight: string;
  // Accent (primary brand color)
  accent: string;
  accentLight: string;
  accentBorder: string;
  // Overlay
  overlay: string;
  // Semantic — identical in both themes
  success: string;
  warning: string;
  error: string;
  errorSurface: string;
  info: string;
  emergency: string;
  // Shadow (always black, only opacity differs)
  shadow: string;
}

export const lightTheme: Theme = {
  bg:            '#F9F7F4',
  surface:       '#FFFFFF',
  surfaceAlt:    '#F3F4F6',
  surfaceDim:    '#F9FAFB',
  text:          '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary:  '#9CA3AF',
  border:        '#E5E7EB',
  borderLight:   '#D1D5DB',
  accent:        '#4F6BED',
  accentLight:   '#EEF2FF',
  accentBorder:  '#C7D2FE',
  overlay:       'rgba(0,0,0,0.3)',
  success:       '#10B981',
  warning:       '#F59E0B',
  error:         '#EF4444',
  errorSurface:  '#FEF2F2',
  info:          '#3B82F6',
  emergency:     '#DC2626',
  shadow:        '#000',
};

/**
 * Hand-tuned dark neutrals: clearer bg vs surface vs raised chrome; borders and muted text read as a ramp, not a flat invert.
 * WCAG spot-check (approximate, primary UI): #F4F4F8 on #16161F (text/surface), #A1A1B0 on #0B0B10 (secondary/bg),
 * #6E6E80 on #1E1E2A (tertiary/surfaceAlt) — verify in-app after palette edits.
 */
export const darkTheme: Theme = {
  bg:            '#0B0B10',
  surface:       '#16161F',
  surfaceAlt:    '#1E1E2A',
  surfaceDim:    '#13131A',
  text:          '#F4F4F8',
  textSecondary: '#A1A1B0',
  textTertiary:  '#6E6E80',
  border:        '#2A2A38',
  borderLight:   '#38384A',
  accent:        '#7B8FF7',
  accentLight:   '#22283D',
  accentBorder:  '#4A5BB0',
  overlay:       'rgba(0,0,0,0.62)',
  success:       '#10B981',
  warning:       '#F59E0B',
  error:         '#EF4444',
  errorSurface:  '#2A1416',
  info:          '#3B82F6',
  emergency:     '#DC2626',
  shadow:        '#000',
};

/* ─────────────────────────────────────────────────────────────
   Non-color tokens — shared across both themes
   ───────────────────────────────────────────────────────────── */

/**
 * Canonical layout rhythm (4pt grid). Use only `space[n]` or sums of these values for
 * margin / padding / gap in new or updated layout code — no one-off layout numbers (10, 14, 18, …).
 *
 * Escape hatch: document with `// layout-exception: <reason>` on that style/property. Exempt
 * without comment: hairlineWidth, % / flex, insets, icon sizes, hitSlop, animation, and standard
 * touch targets (44, 56) where required by platform guidelines.
 */
export type SpaceStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const space: Record<SpaceStep, number> = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
};

/** Named aliases for `space[1]`…`space[8]` (same 4pt rhythm). */
export const space1 = space[1];
export const space2 = space[2];
export const space3 = space[3];
export const space4 = space[4];
export const space5 = space[5];
export const space6 = space[6];
export const space7 = space[7];
export const space8 = space[8];

/** Legacy names — each value is either a `space` step or a sum of steps (e.g. xl = 16+4). Prefer `space` in new code. */
export const spacing = {
  xs: space[1],
  sm: space[2],
  md: space[3],
  lg: space[4],
  xl: space[4] + space[1],
  xxl: space[5],
  xxxl: space[6],
} as const;

/** Corner radii. */
export const radius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 20,
  pill: 999,
} as const;

function scaledTypographyValue(v: number): number {
  const fontScale = PixelRatio.getFontScale();
  if (!Number.isFinite(fontScale) || fontScale <= 0) return v;
  const scaled = v * fontScale;
  return Math.round(scaled * 10) / 10;
}

/**
 * Semantic type scale. Line height: ~1.2× on display/title/heading/subhead; ~1.45–1.55× on body
 * through overline. Letter spacing: tighter on large type, neutral on body/callout, slightly
 * open on caption and below.
 */
export const typography = {
  display:  { fontSize: scaledTypographyValue(32), fontWeight: '800' as const, letterSpacing: -0.55, lineHeight: scaledTypographyValue(38) } satisfies TextStyle,
  title:    { fontSize: scaledTypographyValue(22), fontWeight: '700' as const, letterSpacing: -0.28, lineHeight: scaledTypographyValue(26) } satisfies TextStyle,
  heading:  { fontSize: scaledTypographyValue(18), fontWeight: '700' as const, letterSpacing: -0.18, lineHeight: scaledTypographyValue(22) } satisfies TextStyle,
  subhead:  { fontSize: scaledTypographyValue(16), fontWeight: '600' as const, letterSpacing: -0.08, lineHeight: scaledTypographyValue(19) } satisfies TextStyle,
  body:     { fontSize: scaledTypographyValue(15), fontWeight: '400' as const, letterSpacing: 0, lineHeight: scaledTypographyValue(23) } satisfies TextStyle,
  bodyBold: { fontSize: scaledTypographyValue(15), fontWeight: '600' as const, letterSpacing: 0, lineHeight: scaledTypographyValue(23) } satisfies TextStyle,
  callout:  { fontSize: scaledTypographyValue(14), fontWeight: '500' as const, letterSpacing: 0.08, lineHeight: scaledTypographyValue(21) } satisfies TextStyle,
  caption:  { fontSize: scaledTypographyValue(13), fontWeight: '500' as const, letterSpacing: 0.15, lineHeight: scaledTypographyValue(20) } satisfies TextStyle,
  footnote: { fontSize: scaledTypographyValue(12), fontWeight: '500' as const, letterSpacing: 0.22, lineHeight: scaledTypographyValue(18) } satisfies TextStyle,
  overline: { fontSize: scaledTypographyValue(11), fontWeight: '700' as const, letterSpacing: 0.85, lineHeight: scaledTypographyValue(16) } satisfies TextStyle,
} as const;

/** Primary title in frosted nav rows (toolbar + sheets). */
export function navigationTitleTextStyle(t: Theme): TextStyle {
  return {
    ...typography.subhead,
    color: t.text,
    fontWeight: '700',
    // iOS nav titles read slightly tight at default subhead tracking
    letterSpacing: Platform.OS === 'ios' ? -0.15 : typography.subhead.letterSpacing,
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
      default: {},
    }),
  };
}

/** Secondary line under nav title (same as Home `recipientScroll`). */
export function navigationSubtitleTextStyle(t: Theme): TextStyle {
  return {
    ...typography.callout,
    color: t.accent,
    fontWeight: '600',
    ...Platform.select({
      android: { includeFontPadding: false, textAlignVertical: 'center' as const },
      default: {},
    }),
  };
}

/** Toolbar row height — compact bar; matches Home sticky settings / title row. */
export const NAVIGATION_HEADER_TOOLBAR = 40;

/** Gap under the notch and below the toolbar row (both sides of the 40pt row). */
export const NAVIGATION_HEADER_CHROME_PAD = 2;

/**
 * Total height budget for the frosted secondary header (matches `HomeScreen` `stickyHeaderHeight`).
 * Does not include `hairlineWidth` border; layout measurement covers that.
 */
export function navigationStickyChromeHeight(insetsTop: number): number {
  return insetsTop + NAVIGATION_HEADER_CHROME_PAD + NAVIGATION_HEADER_TOOLBAR + NAVIGATION_HEADER_CHROME_PAD;
}

/** Bottom frosted bar (home indicator + toolbar row) — mirrors `navigationStickyChromeHeight` for the bottom inset. */
export function navigationFooterChromeHeight(insetsBottom: number): number {
  return insetsBottom + NAVIGATION_HEADER_CHROME_PAD + NAVIGATION_HEADER_TOOLBAR + NAVIGATION_HEADER_CHROME_PAD;
}

/**
 * Elevation presets. Shadows on iOS, elevation on Android.
 * `color` param lets callers tint the shadow with a brand color.
 */
export function elevation(level: 1 | 2 | 3 | 4, color = '#000'): ViewStyle {
  if (Platform.OS === 'android') {
    return { elevation: level * 2 };
  }
  const map = {
    1: { opacity: 0.04, radius: 6,  offsetY: 2 },
    2: { opacity: 0.06, radius: 10, offsetY: 3 },
    3: { opacity: 0.10, radius: 16, offsetY: 4 },
    4: { opacity: 0.25, radius: 20, offsetY: 6 },
  }[level];
  return {
    shadowColor: color,
    shadowOpacity: map.opacity,
    shadowRadius: map.radius,
    shadowOffset: { width: 0, height: map.offsetY },
  };
}

/* ─────────────────────────────────────────────────────────────
   Hook
   ───────────────────────────────────────────────────────────── */

export function useTheme(): Theme {
  const preference = useThemeStore((s) => s.colorScheme);
  const systemScheme = useColorScheme();
  const resolved = preference === 'system' ? (systemScheme ?? 'light') : preference;
  return resolved === 'dark' ? darkTheme : lightTheme;
}
