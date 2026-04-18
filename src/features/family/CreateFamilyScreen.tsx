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
import { Family } from '../../types';

export function CreateFamilyScreen() {
  const { user, session } = useAuthStore();
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
    <View style={styles.container}>
      <Text style={styles.title}>Create your family</Text>
      <Text style={styles.subtitle}>Set up a shared space for your care team.</Text>

      <TextInput
        style={styles.input}
        placeholder="Family name"
        placeholderTextColor="#6B7280"
        value={familyName}
        onChangeText={setFamilyName}
        editable={!loading}
      />
      <TextInput
        style={styles.input}
        placeholder="Care recipient's name"
        placeholderTextColor="#6B7280"
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
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.buttonText}>Create Family</Text>
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
    justifyContent: 'center',
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
    marginBottom: 16,
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
    marginTop: 8,
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
