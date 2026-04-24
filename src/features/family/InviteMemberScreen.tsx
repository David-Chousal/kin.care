import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Share,
  Linking,
  Alert,
  Platform,
  InteractionManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';
import { isValidEmailShape } from '../../lib/isValidEmail';
import { useFamilyStore } from '../../store/family';
import { useTheme, spacing, radius, typography, type Theme } from '../../theme';
import { UserRole } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { useMembers } from './hooks/useMembers';
import { useEffectiveTier } from '../../subscription/useEffectiveTier';
import { canInviteMoreMembers } from '../../subscription/featureTierConfig';
import { FeatureLockedCallout } from '../../subscription/FeatureLockedCallout';
import { buildInviteMailtoUrl, buildInviteShareMessage } from './inviteShareMessage';

const ROLES: UserRole[] = ['member', 'viewer'];

/** Tries native share sheet; on failure copies full message and alerts (important on web). */
async function shareInviteMessage(
  token: string,
  invitee: string,
  tx: (key: string, params?: Record<string, unknown>) => string
): Promise<void> {
  const message = buildInviteShareMessage(token, invitee);
  try {
    await Share.share({
      message,
      ...(Platform.OS === 'android' ? { title: tx('family.inviteMember.share.androidTitle') } : {}),
    });
  } catch {
    await Clipboard.setStringAsync(message);
    Alert.alert(
      tx('family.inviteMember.alerts.shareFallback.title'),
      tx('family.inviteMember.alerts.shareFallback.body'),
    );
  }
}

export function InviteMemberScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const headerHeight = useHeaderHeight();
  const { t: tx } = useTranslation();
  const t = useTheme();
  const styles = makeStyles(t);
  const family = useFamilyStore((s) => s.family);
  const familyId = family?.id ?? '';
  const { data: members = [] } = useMembers(familyId);
  const { data: tier = 'free' } = useEffectiveTier();
  const inviteLocked = !canInviteMoreMembers(members.length, tier);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After a successful invite, we keep email + token so the inviter can share (Kin does not send email on its own). */
  const [pendingInvite, setPendingInvite] = useState<{ token: string; email: string } | null>(null);
  const [showRawCode, setShowRawCode] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    if (!pendingInvite) {
      setShowRawCode(false);
      setCopyFeedback(false);
    }
  }, [pendingInvite]);

  useEffect(() => {
    if (!copyFeedback) return;
    const timer = setTimeout(() => setCopyFeedback(false), 2500);
    return () => clearTimeout(timer);
  }, [copyFeedback]);

  async function handleSend() {
    if (!family) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError(tx('family.inviteMember.errors.emailRequired'));
      return;
    }
    if (!isValidEmailShape(trimmed)) {
      setError(tx('family.inviteMember.errors.emailInvalid'));
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('invitations')
      .insert({ family_id: family.id, email: trimmed, role })
      .select('token')
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? tx('family.inviteMember.errors.createFailed'));
      setLoading(false);
      return;
    }

    setPendingInvite({ token: data.token, email: trimmed });
    setEmail('');
    setLoading(false);

    if (Platform.OS !== 'web') {
      InteractionManager.runAfterInteractions(() => {
        void shareInviteMessage(data.token, trimmed, tx);
      });
    }
  }

  async function shareInvite() {
    if (!pendingInvite) return;
    await shareInviteMessage(pendingInvite.token, pendingInvite.email, tx);
  }

  function emailInvite() {
    if (!pendingInvite) return;
    const { token, email: invitee } = pendingInvite;
    const url = buildInviteMailtoUrl(invitee, token);
    Linking.openURL(url).catch(() => {
      Alert.alert(
        tx('family.inviteMember.alerts.mailOpenFailed.title'),
        tx('family.inviteMember.alerts.mailOpenFailed.body'),
      );
    });
  }

  async function copyInviteMessage() {
    if (!pendingInvite) return;
    const message = buildInviteShareMessage(pendingInvite.token, pendingInvite.email);
    await Clipboard.setStringAsync(message);
    setCopyFeedback(true);
  }

  if (inviteLocked) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight + spacing.lg }]}>
        <FeatureLockedCallout
          featureId="unlimited_family_members"
          currentTier={tier}
          onUpgrade={() => navigation.navigate('Subscription', { featureId: 'unlimited_family_members' })}
          showNativePurchaseCta={Platform.OS !== 'web'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.body, { paddingTop: headerHeight + spacing.lg }]}>
        <Text style={styles.subtitle}>
          {tx('family.inviteMember.subtitle')}
        </Text>

        <TextInput
          style={styles.input}
          placeholder={tx('family.inviteMember.emailPlaceholder')}
          placeholderTextColor={t.textSecondary}
          value={email}
          onChangeText={(v) => { setEmail(v); setPendingInvite(null); setError(null); }}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!loading}
        />

        <Text style={styles.label}>{tx('family.inviteMember.roleLabel')}</Text>
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.roleChip, role === r && styles.roleChipActive]}
              onPress={() => setRole(r)}
            >
              <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                {r === 'member' ? tx('family.inviteMember.roles.member') : tx('family.inviteMember.roles.viewer')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        {pendingInvite && (
          <View style={styles.tokenBox}>
            <Text style={styles.successTitle}>{tx('family.inviteMember.success.title')}</Text>
            <Text style={styles.successBody}>
              {tx('family.inviteMember.success.body', { email: pendingInvite.email })}
              {Platform.OS !== 'web' ? tx('family.inviteMember.success.platformNote') : ''}
            </Text>
            <TouchableOpacity style={styles.primaryShareBtn} onPress={() => void shareInvite()}>
              <Text style={styles.primaryShareBtnText}>{tx('family.inviteMember.buttons.share')}</Text>
            </TouchableOpacity>
            <View style={styles.secondaryRow}>
              <TouchableOpacity style={[styles.secondaryBtn, styles.secondaryBtnFlex]} onPress={emailInvite}>
                <Text style={styles.secondaryBtnText}>{tx('family.inviteMember.buttons.email')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.secondaryBtn, styles.secondaryBtnFlex]} onPress={() => void copyInviteMessage()}>
                <Text style={styles.secondaryBtnText}>{tx('family.inviteMember.buttons.copyMessage')}</Text>
              </TouchableOpacity>
            </View>
            {copyFeedback ? (
              <Text style={styles.copyFeedback}>{tx('family.inviteMember.toast.copied')}</Text>
            ) : null}
            <TouchableOpacity
              style={styles.codeDisclosure}
              onPress={() => setShowRawCode((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={
                showRawCode
                  ? tx('family.inviteMember.a11y.hideCode')
                  : tx('family.inviteMember.a11y.showCodeOnly')
              }
            >
              <Text style={styles.codeDisclosureText}>
                {showRawCode ? tx('family.inviteMember.codeDisclosure.hide') : tx('family.inviteMember.codeDisclosure.needCodeOnly')}
              </Text>
            </TouchableOpacity>
            {showRawCode ? (
              <View style={styles.rawCodeBlock}>
                <Text style={styles.tokenLabel}>{tx('family.inviteMember.codeBlock.label')}</Text>
                <Text style={styles.tokenValue} selectable>{pendingInvite.token}</Text>
                <Text style={styles.tokenHint}>{tx('family.inviteMember.codeBlock.hint')}</Text>
              </View>
            ) : null}
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSend}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={t.surface} />
          ) : (
            <Text style={styles.buttonText}>{tx('family.inviteMember.buttons.create')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    body: {
      flex: 1,
      paddingHorizontal: spacing.xxl,
    },
    subtitle: {
      ...typography.subhead,
      fontWeight: '400',
      color: t.textSecondary,
      marginBottom: spacing.xxxl,
    },
    input: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: radius.lg,
      padding: spacing.md + 2,
      fontSize: 16,
      color: t.text,
      backgroundColor: t.surface,
      marginBottom: spacing.xl,
    },
    label: {
      ...typography.callout,
      fontWeight: '600',
      color: t.text,
      marginBottom: spacing.sm + 2,
    },
    roleRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginBottom: spacing.xxl,
    },
    roleChip: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.surface,
    },
    roleChipActive: {
      backgroundColor: t.accentLight,
      borderColor: t.accent,
    },
    roleChipText: {
      ...typography.callout,
      color: t.textSecondary,
    },
    roleChipTextActive: {
      color: t.accent,
      fontWeight: '600',
    },
    error: {
      color: t.error,
      fontSize: 14,
      marginBottom: spacing.md,
    },
    tokenBox: {
      backgroundColor: t.accentLight,
      borderRadius: radius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    successTitle: {
      ...typography.subhead,
      fontWeight: '700',
      color: t.text,
      marginBottom: spacing.sm,
    },
    successBody: {
      ...typography.footnote,
      color: t.textSecondary,
      marginBottom: spacing.lg,
    },
    primaryShareBtn: {
      backgroundColor: t.accent,
      borderRadius: radius.xxl - 4,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    primaryShareBtnText: {
      color: t.surface,
      fontSize: 16,
      fontWeight: '700',
    },
    secondaryRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    secondaryBtnFlex: {
      flex: 1,
    },
    copyFeedback: {
      ...typography.caption,
      color: t.accent,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    codeDisclosure: {
      paddingVertical: spacing.sm,
      marginTop: spacing.xs,
    },
    codeDisclosureText: {
      ...typography.callout,
      color: t.accent,
      fontWeight: '600',
    },
    rawCodeBlock: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },
    tokenLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: t.accent,
      marginBottom: spacing.sm,
    },
    tokenValue: {
      fontSize: 13,
      color: t.text,
      fontFamily: 'monospace' as const,
      marginBottom: spacing.sm,
    },
    tokenHint: {
      ...typography.footnote,
      color: t.textSecondary,
    },
    secondaryBtn: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: {
      ...typography.callout,
      color: t.accent,
      fontWeight: '600',
    },
    button: {
      backgroundColor: t.accent,
      borderRadius: radius.xxl - 4,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonText: {
      color: t.surface,
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
