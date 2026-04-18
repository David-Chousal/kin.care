import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useFamilyStore } from '../../store/family';
import { Family, Invitation } from '../../types';

interface Props {
  onBack: () => void;
}

export function AcceptInviteScreen({ onBack }: Props) {
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
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Join a family</Text>
      <Text style={styles.subtitle}>Paste the invite code from your email.</Text>

      <TextInput
        style={styles.input}
        placeholder="Invite code (UUID)"
        placeholderTextColor="#6B7280"
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
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Join Family</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F7F4',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  back: {
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    color: '#4F6BED',
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1A1A2E',
    backgroundColor: '#FFFFFF',
    marginBottom: 20,
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
  },
  button: {
    backgroundColor: '#4F6BED',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
