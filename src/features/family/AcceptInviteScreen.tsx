import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useFamilyStore } from '../../store/family';
import { Icon } from '../../components/Icon';
import { useTheme, spacing, radius, typography, type Theme } from '../../theme';
import { Family, Invitation } from '../../types';

interface Props {
  /** Shown as a top bar control when provided (e.g. secondary “join” path from create flow). */
  onBack?: () => void;
  /** Optional footer link (e.g. switch to create family). */
  footerAction?: { label: string; onPress: () => void };
}

export function AcceptInviteScreen({ onBack, footerAction }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const setFamily = useFamilyStore((s) => s.setFamily);

  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (!user) return;
    const trimmed = token.trim();
    if (!trimmed) {
      setError('Invite code is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data: inv, error: invError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', trimmed)
      .eq('accepted', false)
      .single();

    if (invError || !inv) {
      setError('Invalid or already used invite code.');
      setLoading(false);
      return;
    }

    const invitation = inv as Invitation;

    if (invitation.email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
      setError('This invite was sent to a different email address.');
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from('family_members').insert({
      family_id: invitation.family_id,
      user_id: user.id,
      role: invitation.role,
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('invitations')
      .update({ accepted: true })
      .eq('id', invitation.id);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .select('*')
      .eq('id', invitation.family_id)
      .single();

    if (familyError || !familyData) {
      setError('Joined family but could not load details. Please restart.');
      setLoading(false);
      return;
    }

    setFamily(familyData as Family);
    setLoading(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.back}>
          <Icon name="back" size={18} color={t.accent} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.backSpacer} />
      )}

      <View style={styles.main}>
        <Text style={styles.title}>Join your family</Text>
        <Text style={styles.subtitle}>Paste the invite code you received from your family (message, email, or notes).</Text>

        <TextInput
          style={styles.input}
          placeholder="Invite code"
          placeholderTextColor={t.textSecondary}
          value={token}
          onChangeText={(v) => { setToken(v); setError(null); }}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleJoin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={t.surface} />
          ) : (
            <Text style={styles.buttonText}>Join family</Text>
          )}
        </TouchableOpacity>
      </View>

      {footerAction ? (
        <TouchableOpacity style={[styles.footerLink, { paddingBottom: insets.bottom + spacing.lg }]} onPress={footerAction.onPress}>
          <Text style={styles.footerLinkText}>{footerAction.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
      paddingHorizontal: spacing.xxl,
    },
    main: { flex: 1, justifyContent: 'center', marginTop: -spacing.xxxl },
    backSpacer: { height: spacing.md },
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 4,
      paddingHorizontal: spacing.xs,
      marginBottom: spacing.lg,
    },
    backText: {
      ...typography.callout,
      fontWeight: '700',
      color: t.accent,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: t.text,
      marginBottom: spacing.sm,
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
    error: {
      color: t.error,
      fontSize: 14,
      marginBottom: spacing.md,
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
    footerLink: { alignItems: 'center', paddingTop: spacing.md },
    footerLinkText: { ...typography.callout, color: t.textTertiary, fontWeight: '600' },
  });
}
