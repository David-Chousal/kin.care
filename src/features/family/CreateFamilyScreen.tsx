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
import { useTheme, spacing, radius, typography, type Theme } from '../../theme';
import { Family } from '../../types';

interface Props {
  footerAction?: { label: string; onPress: () => void };
}

export function CreateFamilyScreen({ footerAction }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const setFamily = useFamilyStore((s) => s.setFamily);

  const [familyName, setFamilyName] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!user) return;
    if (!familyName.trim() || !recipientName.trim()) {
      setError('Both fields are required.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data: familyData, error: familyError } = await supabase
      .from('families')
      .insert({
        name: familyName.trim(),
        care_recipient_name: recipientName.trim(),
        created_by: user.id,
      })
      .select()
      .single();

    if (familyError || !familyData) {
      setError(familyError?.message ?? 'Failed to create family.');
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase.from('family_members').insert({
      family_id: familyData.id,
      user_id: user.id,
      role: 'admin',
    });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    setFamily(familyData as Family);
    setLoading(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <View style={styles.main}>
        <Text style={styles.title}>Create new</Text>
        <Text style={styles.subtitle}>Set up a shared space when you are the one starting the circle.</Text>

        <TextInput
          style={styles.input}
          placeholder="Family name"
          placeholderTextColor={t.textSecondary}
          value={familyName}
          onChangeText={setFamilyName}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Care recipient's name"
          placeholderTextColor={t.textSecondary}
          value={recipientName}
          onChangeText={setRecipientName}
          editable={!loading}
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={t.surface} />
          ) : (
            <Text style={styles.buttonText}>Create family</Text>
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
      marginBottom: spacing.lg,
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
      marginTop: spacing.sm,
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
    footerLinkText: { ...typography.callout, color: t.accent, fontWeight: '600' },
  });
}
