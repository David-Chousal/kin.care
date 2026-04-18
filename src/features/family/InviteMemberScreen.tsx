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
import { useFamilyStore } from '../../store/family';
import { UserRole } from '../../types';

interface Props {
  onBack: () => void;
}

const ROLES: UserRole[] = ['member', 'viewer'];

export function InviteMemberScreen({ onBack }: Props) {
  const family = useFamilyStore((s) => s.family);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('member');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

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

    setInviteToken(data.token);
    setEmail('');
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Invite a member</Text>
      <Text style={styles.subtitle}>They'll receive a token to join your family.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email address"
        placeholderTextColor="#6B7280"
        value={email}
        onChangeText={(v) => { setEmail(v); setInviteToken(null); setError(null); }}
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
      {inviteToken && (
        <View style={styles.tokenBox}>
          <Text style={styles.tokenLabel}>Share this code with your invitee:</Text>
          <Text style={styles.tokenValue} selectable>{inviteToken}</Text>
          <Text style={styles.tokenHint}>They enter this in "Have an invite code? Join instead"</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSend}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Send Invite</Text>
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
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleChip: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  roleChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F6BED',
  },
  roleChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  roleChipTextActive: {
    color: '#4F6BED',
    fontWeight: '600',
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
  },
  tokenBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tokenLabel: {
    fontSize: 13,
    color: '#4F6BED',
    fontWeight: '600',
    marginBottom: 8,
  },
  tokenValue: {
    fontSize: 13,
    color: '#1A1A2E',
    fontFamily: 'monospace' as const,
    marginBottom: 8,
  },
  tokenHint: {
    fontSize: 12,
    color: '#6B7280',
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
