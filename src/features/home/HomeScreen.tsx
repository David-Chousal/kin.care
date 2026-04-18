import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useFamily } from '../family/hooks/useFamily';
import { CreateFamilyScreen } from '../family/CreateFamilyScreen';

export function HomeScreen() {
  const { user } = useAuthStore();
  const { data: family, isLoading } = useFamily();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F6BED" />
      </View>
    );
  }

  if (!family) {
    return <CreateFamilyScreen />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{family.name}</Text>
      <Text style={styles.recipient}>Caring for {family.care_recipient_name}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TouchableOpacity style={styles.button} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: '#F9F7F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    backgroundColor: '#F9F7F4',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1A1A2E',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  recipient: {
    fontSize: 18,
    color: '#4F6BED',
    marginBottom: 8,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#4F6BED',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
