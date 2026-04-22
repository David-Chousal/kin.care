import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useCallback, useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFamilyStore } from '../../store/family';
import { useMembers } from './hooks/useMembers';
import { useInvitations } from './hooks/useInvitations';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { useTheme, spacing, radius, typography, type Theme } from '../../theme';
import { UserRole, Profile } from '../../types';
import type { MainStackParamList } from '../../navigation/types';

function roleBadge(t: Theme): Record<UserRole, { bg: string; text: string }> {
  return {
    admin:  { bg: t.warning + '20', text: t.warning },
    member: { bg: t.accentLight, text: t.accent },
    viewer: { bg: t.surfaceAlt, text: t.textSecondary },
  };
}

function initials(profile: Profile | null, fallback: string): string {
  const name = profile?.full_name ?? fallback;
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function MemberListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const t = useTheme();
  const styles = makeStyles(t);
  const ROLE_BADGE = roleBadge(t);
  const family = useFamilyStore((s) => s.family);
  const familyId = family?.id ?? '';

  const { data: members, isLoading: loadingMembers } = useMembers(familyId);
  const { data: invitations, isLoading: loadingInvitations } = useInvitations(familyId);

  const isLoading = loadingMembers || loadingInvitations;

  const goInvite = useCallback(() => {
    navigation.navigate('InviteMember');
  }, [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label="Invite" onPress={goInvite} />,
    });
  }, [navigation, goInvite]);

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={[styles.centered, { paddingTop: 12 }]}>
            <ActivityIndicator size="large" color={t.accent} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[styles.scrollContent, { paddingTop: spacing.lg }]}
          >
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
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: t.bg,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: radius.lg,
      padding: spacing.md + 2,
      marginBottom: spacing.sm + 2,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    avatarPending: {
      backgroundColor: t.surfaceAlt,
    },
    avatarText: {
      fontSize: 14,
      fontWeight: '700',
      color: t.accent,
    },
    name: {
      flex: 1,
      fontSize: 15,
      fontWeight: '500',
      color: t.text,
    },
    namePending: {
      color: t.textSecondary,
    },
    badge: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.pill,
      marginLeft: spacing.sm,
    },
    badgeText: {
      ...typography.footnote,
      fontWeight: '600',
    },
    sectionLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: t.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: spacing.sm,
      marginBottom: spacing.sm + 2,
    },
    spacer: {
      height: spacing.xxl,
    },
  });
}
