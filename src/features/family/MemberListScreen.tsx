import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useCallback, useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFamilyStore } from '../../store/family';
import { useMembers } from './hooks/useMembers';
import { useInvitations } from './hooks/useInvitations';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { useTheme, spacing, radius, typography, type Theme } from '../../theme';
import type { UserRole, Profile } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { useEffectiveTier } from '../../subscription/useEffectiveTier';
import { canInviteMoreMembers } from '../../subscription/featureTierConfig';
import { UserAvatar } from '../../components/UserAvatar';
import { EmptyState } from '../../components/EmptyState';
import { errorMessageFromUnknown } from '../../lib/errorMessage';

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
  const { data: tier = 'free' } = useEffectiveTier();

  const membersQuery = useMembers(familyId);
  const invitationsQuery = useInvitations(familyId);

  const members = membersQuery.data;
  const invitations = invitationsQuery.data;
  const loadingMembers = membersQuery.isLoading;
  const loadingInvitations = invitationsQuery.isLoading;
  const isLoading = !!familyId && (loadingMembers || loadingInvitations);

  const membersListFatal =
    !!familyId && membersQuery.isError && members === undefined;
  const invitationsLoadError =
    !!familyId &&
    invitationsQuery.isError &&
    invitations === undefined &&
    !membersListFatal;

  const isRefetching =
    (membersQuery.isFetching || invitationsQuery.isFetching) && !isLoading;

  const membersEmpty = (members ?? []).length === 0;

  const refetchAll = () => {
    void Promise.all([membersQuery.refetch(), invitationsQuery.refetch()]);
  };

  const goInvite = useCallback(() => {
    const count = (members ?? []).length;
    if (!canInviteMoreMembers(count, tier)) {
      if (Platform.OS === 'web') {
        Alert.alert(
          'Family is full on Core',
          'Subscribe in the Kin iOS or Android app to invite more than 3 family members.',
        );
        return;
      }
      navigation.navigate('Subscription', { featureId: 'unlimited_family_members' });
      return;
    }
    navigation.navigate('InviteMember');
  }, [navigation, members, tier]);

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
        ) : membersListFatal ? (
          <View style={[styles.centered, styles.errorWrap, { paddingTop: spacing.lg }]}>
            <View style={[styles.errorBox, { backgroundColor: t.errorSurface }]}>
              <Text style={[styles.errorTitle, { color: t.error }]}>{"Couldn't load members"}</Text>
              <Text style={[styles.errorBody, { color: t.textSecondary }]}>
                {errorMessageFromUnknown(membersQuery.error)}
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: t.accent }]}
                onPress={() => void refetchAll()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading members"
              >
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: spacing.lg },
              membersEmpty && { flexGrow: 1 },
            ]}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={() => void refetchAll()}
                tintColor={t.accent}
              />
            }
          >
          {membersEmpty ? (
            <EmptyState
              icon="members"
              title="No family members yet"
              message="Invite relatives or caregivers so everyone can coordinate care in one place."
              actionLabel="Invite someone"
              onAction={goInvite}
            />
          ) : null}
          {(members ?? []).map((m) => {
            const badge = ROLE_BADGE[m.role];
            const displayName = m.profiles?.full_name ?? m.profiles?.email ?? 'Unknown';
            const abbr = initials(m.profiles ?? null, displayName);

            return (
              <View key={m.id} style={styles.row}>
                <View style={styles.memberAvatarSlot}>
                  <UserAvatar
                    size={40}
                    avatarStoragePath={m.profiles?.avatar_url}
                    initials={abbr}
                    backgroundColor={t.accentLight}
                    textColor={t.accent}
                  />
                </View>
                <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
                <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.badgeText, { color: badge.text }]}>{m.role}</Text>
                </View>
              </View>
            );
          })}

          {invitationsLoadError ? (
            <View style={[styles.invitesErrorBox, { backgroundColor: t.errorSurface }]}>
              <Text style={[styles.invitesErrorTitle, { color: t.text }]}>
                {"Couldn't load pending invites"}
              </Text>
              <Text style={[styles.errorBody, { color: t.textSecondary }]}>
                {errorMessageFromUnknown(invitationsQuery.error)}
              </Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: t.accent }]}
                onPress={() => void invitationsQuery.refetch()}
                accessibilityRole="button"
                accessibilityLabel="Retry loading invitations"
              >
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (invitations ?? []).length > 0 ? (
            <>
              <Text style={styles.sectionLabel}>Pending invites</Text>
              {(invitations ?? []).map((inv) => (
                <View key={inv.id} style={styles.row}>
                  <View style={styles.pendingAvatar}>
                    <Text style={styles.pendingAvatarText}>?</Text>
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
          ) : null}

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
    errorWrap: {
      paddingHorizontal: spacing.xl,
    },
    errorBox: {
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.sm + 2,
      alignItems: 'center',
      alignSelf: 'stretch',
      maxWidth: 400,
    },
    errorTitle: {
      ...typography.subhead,
      fontWeight: '700',
      textAlign: 'center',
    },
    errorBody: {
      ...typography.footnote,
      textAlign: 'center',
    },
    invitesErrorBox: {
      borderRadius: radius.lg,
      padding: spacing.md + 2,
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    invitesErrorTitle: {
      ...typography.subhead,
      fontWeight: '600',
    },
    retryBtn: {
      marginTop: spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
    },
    retryBtnText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 15,
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
    memberAvatarSlot: {
      marginRight: spacing.md,
    },
    pendingAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: t.surfaceAlt,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
    },
    pendingAvatarText: {
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
