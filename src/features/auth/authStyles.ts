import { StyleSheet } from 'react-native';
import { radius, typography, space, spacing, type Theme } from '../../theme';

export type AuthStyleOptions = { compact?: boolean };

export function authPlaceholderColor(t: Theme): string {
  return t.textTertiary;
}

/** `compact` tightens vertical rhythm for dense flows (e.g. sign-up step 1). */
export function makeAuthStyles(t: Theme, options?: AuthStyleOptions) {
  const compact = options?.compact === true;
  const inputBlockMargin = compact ? space[3] : space[3] + space[1];
  const labelMarginBottom = compact ? space[1] : space[2];
  const stepHintMarginBottom = compact ? spacing.lg : spacing.xl;
  const checkRowMarginBottom = compact ? space[3] : space[4];
  const inviteBodyMarginBottom = compact ? space[3] : space[4];
  const inputMinHeight = compact ? 48 : 52;

  return StyleSheet.create({
    outer: { flex: 1, backgroundColor: t.bg },
    scrollView: { flex: 1 },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'flex-start',
      width: '100%',
    },
    heroSection: {
      overflow: 'hidden',
    },
    formBlock: {
      flex: 1,
      backgroundColor: t.bg,
    },
    brandInHero: {
      alignItems: 'center',
      gap: space[1],
      marginBottom: space[2],
    },
    appNameHero: {
      ...typography.title,
      fontSize: 28,
      fontWeight: '800',
      color: t.text,
      letterSpacing: -0.5,
    },
    taglineHero: {
      ...typography.body,
      fontSize: 15,
      color: t.textSecondary,
      textAlign: 'center',
    },
    characterOuter: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: t.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    characterFace: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: t.borderLight,
    },
    formTitle: {
      ...typography.display,
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '800',
      letterSpacing: -0.6,
      color: t.text,
      textAlign: 'center',
      width: '100%',
      marginBottom: spacing.xl,
    },
    lead: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
      marginBottom: space[5],
    },
    label: {
      ...typography.caption,
      fontWeight: '600',
      color: t.textSecondary,
      marginBottom: labelMarginBottom,
    },
    inputShell: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      borderRadius: radius.lg,
      backgroundColor: t.surfaceAlt,
      marginBottom: inputBlockMargin,
    },
    inputInShell: {
      paddingHorizontal: space[4],
      paddingVertical: compact ? space[2] + 1 : space[3],
      ...typography.body,
      fontSize: 17,
      lineHeight: 22,
      color: t.text,
      minHeight: inputMinHeight,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      borderRadius: radius.lg,
      backgroundColor: t.surfaceAlt,
      marginBottom: inputBlockMargin,
      minHeight: inputMinHeight,
      paddingRight: space[2],
    },
    input: {
      flex: 1,
      paddingHorizontal: space[4],
      paddingVertical: compact ? space[2] + 1 : space[3],
      ...typography.body,
      fontSize: 17,
      lineHeight: 22,
      color: t.text,
      minHeight: inputMinHeight,
    },
    inputSuffixBtn: {
      padding: space[2],
      justifyContent: 'center',
      alignItems: 'center',
    },
    primaryButton: {
      backgroundColor: t.accent,
      borderRadius: radius.pill,
      height: 56,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: compact ? space[1] : space[2],
      marginBottom: compact ? space[2] : space[3],
    },
    primaryButtonText: {
      ...typography.subhead,
      fontSize: 17,
      fontWeight: '700',
      color: t.surface,
    },
    ghostButton: {
      height: 56,
      borderRadius: radius.pill,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: space[3],
      backgroundColor: 'transparent',
    },
    ghostButtonText: {
      ...typography.subhead,
      fontSize: 17,
      fontWeight: '600',
      color: t.text,
    },
    forgotLinkWrap: {
      alignSelf: 'flex-end',
      marginBottom: space[2],
      marginTop: -space[1],
    },
    forgotLink: {
      ...typography.callout,
      color: t.accent,
      fontWeight: '600',
    },
    toggleBtn: {
      flexDirection: 'row',
      justifyContent: 'center',
      flexWrap: 'wrap',
      paddingVertical: space[2],
    },
    toggleText: { ...typography.callout, color: t.textSecondary },
    toggleLink: { ...typography.callout, color: t.accent, fontWeight: '600' },
    errorBox: {
      backgroundColor: t.errorSurface,
      borderRadius: radius.md,
      padding: space[3],
      marginBottom: space[3] + space[1],
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    errorText: { ...typography.caption, color: t.error, textAlign: 'center' },
    successOuter: {
      flex: 1,
      backgroundColor: t.bg,
      justifyContent: 'center',
    },
    successTitle: {
      ...typography.title,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
      color: t.text,
      textAlign: 'center',
      marginBottom: space[4],
    },
    successBody: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
      textAlign: 'center',
    },
    successIconWrap: {
      alignSelf: 'center',
      marginBottom: space[4],
      padding: space[2],
      borderRadius: radius.pill,
      backgroundColor: t.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
    },
    successDescBlock: {
      width: '100%',
      alignItems: 'center',
      marginBottom: space[5],
    },
    successDescBody: {
      ...typography.body,
      fontSize: 16,
      lineHeight: 24,
      color: t.textSecondary,
      textAlign: 'center',
    },
    successEmailMark: {
      ...typography.subhead,
      fontSize: 15,
      fontWeight: '600',
      color: t.text,
      backgroundColor: t.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.border,
      paddingVertical: space[1] + 1,
      paddingHorizontal: space[2],
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    successPrimaryButton: {
      alignSelf: 'stretch',
    },
    secondaryGhost: {
      alignSelf: 'center',
      paddingVertical: spacing.md,
      marginTop: spacing.xs,
    },
    secondaryGhostText: {
      ...typography.callout,
      color: t.accent,
      fontWeight: '600',
      textAlign: 'center',
    },
    stepHint: {
      ...typography.caption,
      color: t.textSecondary,
      marginBottom: stepHintMarginBottom,
      textAlign: 'center',
      width: '100%',
    },
    inviteBody: {
      ...typography.body,
      color: t.textSecondary,
      marginBottom: inviteBodyMarginBottom,
      textAlign: 'center',
      width: '100%',
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: space[3],
      marginBottom: checkRowMarginBottom,
      width: '100%',
    },
    checkBox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.border,
      marginTop: 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surfaceAlt,
    },
    checkBoxOn: {
      backgroundColor: t.accent,
      borderColor: t.accent,
    },
    checkLabel: {
      ...typography.body,
      fontSize: 14,
      lineHeight: 20,
      color: t.textSecondary,
      flex: 1,
    },
    link: {
      color: t.accent,
      fontWeight: '600',
    },
  });
}

