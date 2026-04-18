import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useFamilyStore } from '../../store/family';
import { useMembers } from './hooks/useMembers';
import { useInvitations } from './hooks/useInvitations';
import { UserRole, Profile } from '../../types';

interface Props {
  onInvite: () => void;
  onBack: () => void;
}

const ROLE_BADGE: Record<UserRole, { bg: string; text: string }> = {
  admin: { bg: '#FEF3C7', text: '#D97706' },
  member: { bg: '#EEF2FF', text: '#4F6BED' },
  viewer: { bg: '#F3F4F6', text: '#6B7280' },
};

function initials(profile: Profile | null, fallback: string): string {
  const name = profile?.full_name ?? fallback;
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function MemberListScreen({ onInvite, onBack }: Props) {
  const family = useFamilyStore((s) => s.family);
  const familyId = family?.id ?? '';

  const { data: members, isLoading: loadingMembers } = useMembers(familyId);
  const { data: invitations, isLoading: loadingInvitations } = useInvitations(familyId);

  const isLoading = loadingMembers || loadingInvitations;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Members</Text>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4F6BED" />
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {(members ?? []).map((m) => {
            const badge = ROLE_BADGE[m.role];
            const displayName = m.profiles?.full_name ?? m.profiles?.email ?? 'Unknown';
            const abbr = initials(m.profiles ?? null, displayName);

            return (
              <View key={m.id} style={styles.row}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{abbr}</Text>
                </View>
                <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>{m.role}</Text>
                </View>
              </View>
            );
          })}

          {(invitations ?? []).length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Pending invites</Text>
              {(invitations ?? []).map((inv) => (
                <View key={inv.id} style={styles.row}>
                  <View style={[styles.avatar, styles.avatarPending]}>
                    <Text style={styles.avatarText}>?</Text>
                  </View>
                  <Text style={[styles.name, styles.namePending]} numberOfLines={1}>
                    {inv.email}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: ROLE_BADGE[inv.role].bg }]}>
                    <Text style={[styles.badgeText, { color: ROLE_BADGE[inv.role].text }]}>
                      {inv.role}
                    </Text>
                  </View>
                </View>
              ))}
            </>
          )}

          <View style={styles.spacer} />
        </ScrollView>
      )}

      <TouchableOpacity style={styles.button} onPress={onInvite}>
        <Text style={styles.buttonText}>Invite Member</Text>
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
    marginBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarPending: {
    backgroundColor: '#F3F4F6',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F6BED',
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
  },
  namePending: {
    color: '#6B7280',
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 10,
  },
  spacer: {
    height: 24,
  },
  button: {
    backgroundColor: '#4F6BED',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 32,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
