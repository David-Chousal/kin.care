import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { useFamilyStore } from '../../store/family';
import { useFamily } from '../family/hooks/useFamily';
import { CreateFamilyScreen } from '../family/CreateFamilyScreen';
import { AcceptInviteScreen } from '../family/AcceptInviteScreen';
import { MemberListScreen } from '../family/MemberListScreen';
import { InviteMemberScreen } from '../family/InviteMemberScreen';
import { TaskBoardScreen } from '../tasks/TaskBoardScreen';

type ActiveView = 'dashboard' | 'members' | 'invite' | 'tasks';

export function HomeScreen() {
  const { user } = useAuthStore();
  const { isLoading } = useFamily();
  const family = useFamilyStore((s) => s.family);
  const [view, setView] = useState<ActiveView>('dashboard');
  const [showJoin, setShowJoin] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4F6BED" />
      </View>
    );
  }

  if (!family) {
    if (showJoin) {
      return <AcceptInviteScreen onBack={() => setShowJoin(false)} />;
    }
    return (
      <View style={styles.noFamilyContainer}>
        <CreateFamilyScreen />
        <TouchableOpacity style={styles.joinLink} onPress={() => setShowJoin(true)}>
          <Text style={styles.joinLinkText}>Have an invite code? Join instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (view === 'members') {
    return (
      <MemberListScreen
        onInvite={() => setView('invite')}
        onBack={() => setView('dashboard')}
      />
    );
  }

  if (view === 'invite') {
    return <InviteMemberScreen onBack={() => setView('members')} />;
  }

  if (view === 'tasks') {
    return <TaskBoardScreen onBack={() => setView('dashboard')} />;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{family.name}</Text>
      <Text style={styles.recipient}>Caring for {family.care_recipient_name}</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <TouchableOpacity style={styles.button} onPress={() => setView('tasks')}>
        <Text style={styles.buttonText}>Tasks</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => setView('members')}>
        <Text style={styles.buttonText}>Members</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonSecondary]}
        onPress={() => supabase.auth.signOut()}
      >
        <Text style={styles.buttonTextSecondary}>Sign Out</Text>
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
  noFamilyContainer: {
    flex: 1,
    backgroundColor: '#F9F7F4',
  },
  joinLink: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 8,
  },
  joinLinkText: {
    fontSize: 15,
    color: '#4F6BED',
    fontWeight: '500',
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
    width: '100%',
    marginBottom: 12,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
});
