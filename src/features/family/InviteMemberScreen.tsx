import { useState } from 'react';
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../lib/supabase';
import { useFamilyStore } from '../../store/family';
import { useTheme, spacing, radius, typography, type Theme } from '../../theme';
import { UserRole } from '../../types';
import type { MainStackParamList } from '../../navigation/types';

const ROLES: UserRole[] = ['member', 'viewer'];

export function InviteMemberScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const t = useTheme();
  const styles = makeStyles(t);
  const family = useFamilyStore((s) => s.family);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** After a successful invite, we keep email + token so the inviter can share (Kin does not send email on its own). */
  const [pendingInvite, setPendingInvite] = useState<{ token: string; email: string } | null>(null);

  async function handleSend() {
    if (!family) return;
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Email is required.');
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
      setError(insertError?.message ?? 'Failed to create invite.');
      setLoading(false);
      return;
    }

    setPendingInvite({ token: data.token, email: trimmed });
    setEmail('');
    setLoading(false);
  }

  async function shareInvite() {
    if (!pendingInvite) return;
    const { token, email: invitee } = pendingInvite;
    try {
      await Share.share({
        message:
          `You're invited to Kin (family care app).\n\n` +
          `Use this invite code in the app under "Have an invite code? Join your family":\n${token}\n\n` +
          `Sign up or sign in with this same email address: ${invitee}`,
      });
    } catch {
      Alert.alert('Could not share', 'Copy the code or use Email invite instead.');
    }
  }

  function emailInvite() {
    if (!pendingInvite) return;
    const { token, email: invitee } = pendingInvite;
    const subject = encodeURIComponent('Invitation to join Kin');
    const body = encodeURIComponent(
      "You've been invited to coordinate care on Kin.\n\n" +
        `1) Install Kin and create an account with this email: ${invitee}\n` +
        `2) In the app, choose "Have an invite code? Join your family"\n` +
        `3) Paste this invite code:\n\n${token}\n`,
    );
    const url = `mailto:${invitee}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Could not open Mail', 'Copy the invite code and send it with your email app.');
    });
  }

  async function copyInviteCode() {
    if (!pendingInvite) return;
    await Clipboard.setStringAsync(pendingInvite.token);
  }

  return (
    <View style={styles.container}>
      <View style={[styles.body, { paddingTop: spacing.lg }]}>
      <Text style={styles.subtitle}>
        Kin does not email them automatically—we save their email so it must match their account. Share the code
        using the buttons below.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor={t.textSecondary}
        value={email}
        onChangeText={(v) => { setEmail(v); setPendingInvite(null); setError(null); }}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!loading}
      />

      <Text style={styles.label}>Role</Text>
      <View style={styles.roleRow}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.roleChip, role === r && styles.roleChipActive]}
            onPress={() => setRole(r)}
          >
            <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
              {r.charAt(0).toUpperCase() + r.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {pendingInvite && (
        <View style={styles.tokenBox}>
          <Text style={styles.tokenLabel}>Invite code</Text>
          <Text style={styles.tokenValue} selectable>{pendingInvite.token}</Text>
          <Text style={styles.tokenHint}>They enter this in &quot;Have an invite code? Join instead&quot;</Text>
          <View style={styles.inviteActions}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={shareInvite}>
              <Text style={styles.secondaryBtnText}>Share…</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={emailInvite}>
              <Text style={styles.secondaryBtnText}>Email invite</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={copyInviteCode}>
              <Text style={styles.secondaryBtnText}>Copy code</Text>
            </TouchableOpacity>
          </View>
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
          <Text style={styles.buttonText}>Create invite</Text>
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
    inviteActions: {
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    secondaryBtn: {
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: t.accent,
      alignItems: 'center',
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
