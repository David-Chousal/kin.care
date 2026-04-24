import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, TextInput, Linking, Share,
} from 'react-native';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { hapticSelection } from '../../lib/haptics';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { errorMessageFromUnknown } from '../../lib/errorMessage';
import {
  readFunctionsHttpErrorPayload,
  buildDeleteAccountFailureHint,
} from '../../lib/functionsInvokePayload';
import { Sentry } from '../../lib/sentry';
import { UserAvatar } from '../../components/UserAvatar';
import { ProfileRowSkeleton } from '../../components/SkeletonCard';
import {
  uploadProfileAvatar,
  removeProfileAvatarPaths,
} from '../../features/profile/profileAvatarStorage';
import { useAuthStore } from '../../store/auth';
import { useFamilyStore } from '../../store/family';
import { useTheme, type Theme } from '../../theme';
import type { Profile } from '../../types';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../../config/legal';
import { PolicyViewer, PRIVACY_POLICY, TERMS_OF_SERVICE } from './PolicyViewer';
import { Collapsible, DisclosureChevron } from '../../components/Collapsible';
import type { MainStackParamList } from '../../navigation/types';
import { useEffectiveTier, useRemoveEffectiveTierQueries } from '../../subscription/useEffectiveTier';
import { featureUnlocked } from '../../subscription/featureTierConfig';
import { TIER_DISPLAY_NAME } from '../../subscription/featureTierConfig';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

// ─── Reusable row components ─────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function LinkRow({
  label,
  sublabel,
  value,
  right,
  onPress,
  disabled = false,
  danger = false,
  chevron = true,
}: {
  label: string; sublabel?: string; value?: string;
  right?: ReactNode;
  onPress: () => void; danger?: boolean; chevron?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <TouchableOpacity
      style={[styles.row, disabled && { opacity: 0.55 }]}
      onPress={onPress}
      activeOpacity={0.6}
      disabled={disabled}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, danger && { color: t.error }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right ?? null}
      {chevron ? <Text style={styles.rowChevron}>›</Text> : null}
    </TouchableOpacity>
  );
}

function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 16 }} />;
}

// ─── Data export ─────────────────────────────────────────────────────────────

async function buildExport(
  familyId: string,
  familyName: string,
  recipientName: string,
  formatLocale: string,
  tr: TFunction,
): Promise<string> {
  const [tasks, meds, logs, events, checkins] = await Promise.all([
    supabase.from('tasks').select('title, completed, due_date').eq('family_id', familyId).order('created_at', { ascending: false }),
    supabase.from('medications').select('name, dosage, frequency').eq('family_id', familyId).eq('active', true),
    supabase.from('health_logs').select('title, category, value, unit, logged_at, photo_path').eq('family_id', familyId).order('logged_at', { ascending: false }).limit(100),
    supabase.from('calendar_events').select('title, starts_at, location').eq('family_id', familyId).order('starts_at', { ascending: false }).limit(100),
    supabase.from('checkins').select('mood, summary, notes, created_at').eq('family_id', familyId).order('created_at', { ascending: false }).limit(50),
  ]);

  const date = new Date().toLocaleDateString(formatLocale, { year: 'numeric', month: 'long', day: 'numeric' });
  const hr = '─'.repeat(32);
  const lines: string[] = [
    tr('settings.export.title'),
    date,
    tr('settings.export.familyLine', { name: familyName }),
    tr('settings.export.caringLine', { name: recipientName }),
    '',
  ];

  lines.push(hr, tr('settings.export.sectionTasks', { count: (tasks.data ?? []).length }), hr);
  for (const taskRow of tasks.data ?? []) {
    const due = taskRow.due_date
      ? tr('settings.export.taskDue', { date: new Date(taskRow.due_date).toLocaleDateString(formatLocale) })
      : '';
    lines.push(`${taskRow.completed ? '[x]' : '[ ]'}  ${taskRow.title}${due}`);
  }

  lines.push('', hr, tr('settings.export.sectionMedications', { count: (meds.data ?? []).length }), hr);
  for (const m of meds.data ?? []) lines.push(`•  ${m.name} — ${m.dosage} — ${m.frequency}`);

  lines.push('', hr, tr('settings.export.sectionHealth', { count: (logs.data ?? []).length }), hr);
  for (const l of logs.data ?? []) {
    const d = new Date(l.logged_at).toLocaleDateString(formatLocale);
    const val = l.value ? `  ${l.value}${l.unit ? ' ' + l.unit : ''}` : '';
    const photo = l.photo_path ? tr('settings.export.healthPhoto') : '';
    lines.push(`[${d}]  ${l.category.toUpperCase()}: ${l.title}${val}${photo}`);
  }

  lines.push('', hr, tr('settings.export.sectionCalendar', { count: (events.data ?? []).length }), hr);
  for (const e of events.data ?? []) {
    const d = new Date(e.starts_at).toLocaleDateString(formatLocale);
    const loc = e.location ? tr('settings.export.calendarAt', { location: e.location }) : '';
    lines.push(`[${d}]  ${e.title}${loc}`);
  }

  lines.push('', hr, tr('settings.export.sectionCheckins', { count: (checkins.data ?? []).length }), hr);
  for (const c of checkins.data ?? []) {
    const d = new Date(c.created_at).toLocaleDateString(formatLocale);
    lines.push(`[${d}]  ${c.mood.toUpperCase()}: ${c.summary}`);
    if (c.notes) lines.push(`       ${c.notes}`);
  }

  return lines.join('\n');
}

// ─── Main screen ─────────────────────────────────────────────────────────────

function tierPlanLabel(tier: 'free' | 'family' | 'care_team'): string {
  return TIER_DISPLAY_NAME[tier];
}

export function SettingsScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const formatLocale = useFormatLocaleTag();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const queryClient = useQueryClient();
  const { data: effectiveTier = 'free' } = useEffectiveTier();
  const removeTierQueries = useRemoveEffectiveTierQueries();
  const { user } = useAuthStore();
  const family = useFamilyStore((s) => s.family);
  const setFamily = useFamilyStore((s) => s.setFamily);

  // Profile state
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // Family state (per-row disclosure, same motion as home dashboard toggles)
  const [familyNameExpanded, setFamilyNameExpanded] = useState(false);
  const [careRecipientExpanded, setCareRecipientExpanded] = useState(false);
  const [familyName, setFamilyName] = useState(family?.name ?? '');
  const [recipientName, setRecipientName] = useState(family?.care_recipient_name ?? '');
  const [savingFamilyName, setSavingFamilyName] = useState(false);
  const [savingCareRecipient, setSavingCareRecipient] = useState(false);

  const displayNameInputRef = useRef<TextInput>(null);

  // Privacy
  const [exporting, setExporting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { setProfile(data as Profile | null); setLoadingProfile(false); });
  }, [user?.id]);

  useEffect(() => {
    setFamilyName(family?.name ?? '');
    setRecipientName(family?.care_recipient_name ?? '');
  }, [family?.id]);

  useEffect(() => {
    if (!familyNameExpanded) setFamilyName(family?.name ?? '');
  }, [family?.name, familyNameExpanded]);

  useEffect(() => {
    if (!careRecipientExpanded) setRecipientName(family?.care_recipient_name ?? '');
  }, [family?.care_recipient_name, careRecipientExpanded]);

  useEffect(() => {
    if (!editingName) return;
    const focusTimer = setTimeout(() => displayNameInputRef.current?.focus(), 320);
    return () => clearTimeout(focusTimer);
  }, [editingName]);

  // ── Profile ──────────────────────────────────────────────────────────────
  async function saveDisplayName() {
    if (!user) return;
    setSavingName(true);
    await supabase.from('profiles').update({ full_name: nameInput.trim() || null }).eq('id', user.id);
    setProfile((p) => p ? { ...p, full_name: nameInput.trim() || null } : p);
    setSavingName(false);
    setEditingName(false);
  }

  function invalidateAvatarRelatedQueries() {
    const fid = family?.id;
    if (!fid) return;
    void queryClient.invalidateQueries({ queryKey: ['tasks', fid] });
    void queryClient.invalidateQueries({ queryKey: ['members', fid] });
  }

  async function applyPickedAvatar(uri: string, mimeType: string) {
    if (!user) return;
    setSavingAvatar(true);
    const prevPath = profile?.avatar_url ?? null;
    try {
      const newPath = await uploadProfileAvatar(user.id, uri, mimeType);
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: newPath })
        .eq('id', user.id)
        .select()
        .single();
      if (error) {
        await removeProfileAvatarPaths([newPath]).catch(() => {});
        throw error;
      }
      if (prevPath && prevPath !== newPath) {
        await removeProfileAvatarPaths([prevPath]).catch(() => {});
      }
      setProfile(data as Profile);
      invalidateAvatarRelatedQueries();
    } catch (e) {
      Alert.alert(tx('settings.profile.avatarUploadFailedTitle'), errorMessageFromUnknown(e));
    } finally {
      setSavingAvatar(false);
    }
  }

  async function pickProfilePhotoFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        tx('settings.profile.avatarPermissionTitle'),
        tx('settings.profile.avatarLibraryPermissionMessage'),
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    await applyPickedAvatar(asset.uri, mimeType);
  }

  async function pickProfilePhotoFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        tx('settings.profile.avatarPermissionTitle'),
        tx('settings.profile.avatarCameraPermissionMessage'),
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    await applyPickedAvatar(asset.uri, mimeType);
  }

  function confirmRemoveProfileAvatar() {
    Alert.alert(
      tx('settings.profile.avatarRemoveConfirmTitle'),
      tx('settings.profile.avatarRemoveConfirmMessage'),
      [
        { text: tx('common.cancel'), style: 'cancel' },
        {
          text: tx('settings.profile.avatarRemove'),
          style: 'destructive',
          onPress: () => { void executeRemoveProfileAvatar(); },
        },
      ],
    );
  }

  async function executeRemoveProfileAvatar() {
    if (!user?.id || !profile?.avatar_url) return;
    setSavingAvatar(true);
    const path = profile.avatar_url;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      await removeProfileAvatarPaths([path]).catch(() => {});
      setProfile(data as Profile);
      invalidateAvatarRelatedQueries();
    } catch (e) {
      Alert.alert(tx('settings.profile.avatarUploadFailedTitle'), errorMessageFromUnknown(e));
    } finally {
      setSavingAvatar(false);
    }
  }

  function openProfileAvatarMenu() {
    hapticSelection();
    const buttons: {
      text: string;
      style?: 'destructive' | 'cancel';
      onPress?: () => void;
    }[] = [
      { text: tx('settings.profile.avatarChoosePhoto'), onPress: () => { void pickProfilePhotoFromLibrary(); } },
      { text: tx('settings.profile.avatarTakePhoto'), onPress: () => { void pickProfilePhotoFromCamera(); } },
    ];
    if (profile?.avatar_url) {
      buttons.push({
        text: tx('settings.profile.avatarRemove'),
        style: 'destructive',
        onPress: confirmRemoveProfileAvatar,
      });
    }
    buttons.push({ text: tx('common.cancel'), style: 'cancel' });
    Alert.alert(tx('settings.profile.avatarTitle'), tx('settings.profile.avatarMessage'), buttons);
  }

  // ── Family ───────────────────────────────────────────────────────────────
  async function refreshFamilyInStore() {
    if (!user?.id) return;
    await queryClient.invalidateQueries({ queryKey: ['family', user.id] });
  }

  async function saveFamilyNameOnly() {
    if (!family || !familyName.trim()) return;
    setSavingFamilyName(true);
    const { error } = await supabase.from('families')
      .update({ name: familyName.trim() })
      .eq('id', family.id);
    setSavingFamilyName(false);
    if (error) {
      Alert.alert(tx('settings.alerts.saveFailedTitle'), tx('settings.alerts.saveFailedMessage'));
      return;
    }
    setFamily({ ...family, name: familyName.trim() });
    await refreshFamilyInStore();
    setFamilyNameExpanded(false);
  }

  async function saveCareRecipientOnly() {
    if (!family) return;
    setSavingCareRecipient(true);
    const { error } = await supabase.from('families')
      .update({ care_recipient_name: recipientName.trim() })
      .eq('id', family.id);
    setSavingCareRecipient(false);
    if (error) {
      Alert.alert(tx('settings.alerts.saveFailedTitle'), tx('settings.alerts.saveFailedMessage'));
      return;
    }
    setFamily({ ...family, care_recipient_name: recipientName.trim() });
    await refreshFamilyInStore();
    setCareRecipientExpanded(false);
  }

  function toggleFamilyNameRow() {
    hapticSelection();
    setFamilyNameExpanded((prev) => {
      if (prev) {
        setFamilyName(family?.name ?? '');
        return false;
      }
      setEditingName(false);
      setFamilyName(family?.name ?? '');
      setCareRecipientExpanded(false);
      return true;
    });
  }

  function toggleCareRecipientRow() {
    hapticSelection();
    setCareRecipientExpanded((prev) => {
      if (prev) {
        setRecipientName(family?.care_recipient_name ?? '');
        return false;
      }
      setEditingName(false);
      setRecipientName(family?.care_recipient_name ?? '');
      setFamilyNameExpanded(false);
      return true;
    });
  }

  // ── Export ───────────────────────────────────────────────────────────────
  async function handleExport() {
    if (!family) return;
    if (!featureUnlocked(effectiveTier, 'clinical_data_export')) {
      Alert.alert(
        'Care Team export',
        'Structured family export for clinical workflows is included with Care Team. Upgrade to unlock.',
        [
          { text: 'Not now', style: 'cancel' },
          {
            text: 'View plans',
            onPress: () => navigation.navigate('Subscription', { featureId: 'clinical_data_export' }),
          },
        ],
      );
      return;
    }
    setExporting(true);
    try {
      const text = await buildExport(family.id, family.name, family.care_recipient_name, formatLocale, tx);
      await Share.share({ message: text, title: tx('settings.export.shareTitle', { name: family.name }) });
    } catch {
      Alert.alert(tx('settings.alerts.exportFailedTitle'), tx('settings.alerts.exportFailedMessage'));
    }
    setExporting(false);
  }

  // ── Delete account ───────────────────────────────────────────────────────
  function confirmDeleteAccount() {
    Alert.alert(
      tx('settings.alerts.deleteTitle'),
      tx('settings.alerts.deleteMessage'),
      [
        { text: tx('common.cancel'), style: 'cancel' },
        {
          text: tx('settings.alerts.deleteConfirm'), style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setDeletingAccount(true);
            const logDeleteAccountDebug =
              __DEV__ || process.env.EXPO_PUBLIC_APP_VARIANT === 'staging';
            try {
              // refreshSession can fail while access_token is still valid; do not block delete on that alone.
              await supabase.auth.refreshSession().catch(() => undefined);
              const { data: sessionWrap } = await supabase.auth.getSession();
              if (!sessionWrap?.session?.access_token) {
                throw new Error('Session expired. Please sign in again, then try deleting your account.');
              }

              const { data, error } = await supabase.functions.invoke('delete-account', { body: {} });
              const shouldReportInvoke =
                error != null || (data != null && typeof data === 'object' && 'ok' in data && data.ok !== true);
              if (logDeleteAccountDebug) {
                const httpPayload = error instanceof FunctionsHttpError
                  ? await readFunctionsHttpErrorPayload(error)
                  : null;
                console.warn('[delete-account]', {
                  invokeErrorMessage: (error as Error | null)?.message,
                  httpStatus: error instanceof FunctionsHttpError
                    ? (error.context as Response).status
                    : undefined,
                  httpPayload,
                  data,
                });
              } else if (shouldReportInvoke && process.env.EXPO_PUBLIC_SENTRY_DSN) {
                const httpPayload = error instanceof FunctionsHttpError
                  ? await readFunctionsHttpErrorPayload(error)
                  : null;
                Sentry.captureException(
                  error ?? new Error('[delete-account] invoke returned ok=false'),
                  {
                    tags: { flow: 'delete_account' },
                    extra: {
                      stage: 'invoke',
                      httpPayload,
                      data,
                    },
                  }
                );
              }
              if (error) throw error;
              if (!data?.ok) throw new Error('Account deletion failed.');
            } catch (e) {
              const fromFn = await buildDeleteAccountFailureHint(e);
              const fallback = errorMessageFromUnknown(e).trim();
              const hintRaw = (fromFn?.trim() || (fallback !== 'Unknown error' ? fallback : '')).trim();
              const hint = hintRaw.length > 0 ? hintRaw.slice(0, 400) : undefined;
              const httpPayload = e instanceof FunctionsHttpError
                ? await readFunctionsHttpErrorPayload(e)
                : null;
              if (logDeleteAccountDebug) {
                console.warn('[delete-account] catch', {
                  message: errorMessageFromUnknown(e),
                  hint,
                  httpPayload,
                });
              } else if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
                Sentry.captureException(e, {
                  tags: { flow: 'delete_account' },
                  extra: { hint: hint ?? null, httpPayload },
                });
              }
              const body = hint
                ? `${tx('settings.alerts.deleteFailedMessage')}\n\n${hint}`
                : tx('settings.alerts.deleteFailedMessage');
              Alert.alert(tx('settings.alerts.deleteFailedTitle'), body);
              setDeletingAccount(false);
              return;
            }

            // Auth user is deleted server-side; best-effort local sign out to clear state.
            try {
              await supabase.auth.signOut();
            } catch (signOutErr) {
              if (__DEV__ || process.env.EXPO_PUBLIC_APP_VARIANT === 'staging') {
                console.warn('[delete-account] signOut after successful delete', signOutErr);
              } else if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
                Sentry.captureException(signOutErr, {
                  tags: { flow: 'delete_account' },
                  extra: { stage: 'sign_out_after_delete' },
                });
              }
            }
            removeTierQueries();
            setDeletingAccount(false);
          },
        },
      ]
    );
  }

  function confirmSignOut() {
    Alert.alert(tx('settings.alerts.signOutTitle'), tx('settings.alerts.signOutMessage'), [
      { text: tx('common.cancel'), style: 'cancel' },
      {
        text: tx('settings.alerts.signOutConfirm'),
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await supabase.auth.signOut();
            removeTierQueries();
          } catch (e) {
            Alert.alert(tx('settings.alerts.signOutTitle'), errorMessageFromUnknown(e));
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

  const displayName = profile?.full_name;
  const email = user?.email ?? '';
  const initials = displayName
    ? displayName.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : email.slice(0, 2).toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >

        {/* ── Account ───────────────────────────────── */}
        <SectionHeader title={tx('settings.sections.account')} />
        <View style={styles.card}>
          <View style={styles.profileRow}>
            {loadingProfile ? <ProfileRowSkeleton /> : (
              <>
                <TouchableOpacity
                  onPress={openProfileAvatarMenu}
                  disabled={savingAvatar}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={tx('settings.profile.avatarTitle')}
                >
                  <View style={styles.avatarWrap}>
                    <UserAvatar
                      size={48}
                      avatarStoragePath={profile?.avatar_url}
                      initials={initials}
                      backgroundColor={t.accent}
                      textColor={t.surface}
                    />
                    {savingAvatar ? (
                      <View style={styles.avatarSavingOverlay}>
                        <ActivityIndicator color={t.surface} />
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  {displayName ? <Text style={styles.profileName}>{displayName}</Text> : null}
                  <Text style={styles.profileEmail}>{email}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    hapticSelection();
                    setFamilyNameExpanded(false);
                    setCareRecipientExpanded(false);
                    setNameInput(displayName ?? '');
                    setEditingName(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.editLink}>{tx('common.edit')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Collapsible expanded={editingName}>
            <View>
              <Divider />
              <View style={styles.inlineEdit}>
                <TextInput
                  ref={displayNameInputRef}
                  style={styles.inlineInput}
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder={tx('settings.profile.displayNamePlaceholder')}
                  placeholderTextColor={t.textTertiary}
                  returnKeyType="done"
                  onSubmitEditing={saveDisplayName}
                />
                <View style={styles.inlineActions}>
                  <TouchableOpacity style={styles.inlineCancelBtn} onPress={() => setEditingName(false)}>
                    <Text style={styles.inlineCancelText}>{tx('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.inlineSaveBtn, savingName && { opacity: 0.6 }]}
                    onPress={saveDisplayName} disabled={savingName}
                  >
                    {savingName
                      ? <ActivityIndicator color={t.surface} size="small" />
                      : <Text style={styles.inlineSaveText}>{tx('common.save')}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Collapsible>

          <Divider />
          <LinkRow
            label="Subscription"
            sublabel={`Current plan: ${tierPlanLabel(effectiveTier)}`}
            onPress={() => navigation.navigate('Subscription')}
          />
        </View>

        {/* ── Family ────────────────────────────────── */}
        <SectionHeader title={tx('settings.sections.family')} />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.familyDisclosureRow}
            onPress={toggleFamilyNameRow}
            activeOpacity={0.65}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowLabel}>{tx('settings.family.nameLabel')}</Text>
            </View>
            {!familyNameExpanded && family?.name ? (
              <Text style={styles.rowValue} numberOfLines={1}>{family.name}</Text>
            ) : null}
            <DisclosureChevron expanded={familyNameExpanded} color={t.borderLight} size={18} />
          </TouchableOpacity>
          <Collapsible expanded={familyNameExpanded}>
            <View style={styles.familyCollapsibleInner}>
              <Text style={styles.editFieldLabel}>{tx('settings.family.nameLabel')}</Text>
              <TextInput
                style={styles.inlineInput}
                value={familyName}
                onChangeText={setFamilyName}
                placeholder={tx('settings.family.namePlaceholder')}
                placeholderTextColor={t.textTertiary}
              />
              <View style={styles.inlineActions}>
                <TouchableOpacity
                  style={styles.inlineCancelBtn}
                  onPress={() => {
                    setFamilyName(family?.name ?? '');
                    setFamilyNameExpanded(false);
                  }}
                >
                  <Text style={styles.inlineCancelText}>{tx('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineSaveBtn, savingFamilyName && { opacity: 0.6 }]}
                  onPress={saveFamilyNameOnly}
                  disabled={savingFamilyName || !familyName.trim()}
                >
                  {savingFamilyName
                    ? <ActivityIndicator color={t.surface} size="small" />
                    : <Text style={styles.inlineSaveText}>{tx('common.save')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Collapsible>

          <Divider />

          <TouchableOpacity
            style={styles.familyDisclosureRow}
            onPress={toggleCareRecipientRow}
            activeOpacity={0.65}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowLabel}>{tx('settings.family.caringForLabel')}</Text>
            </View>
            {!careRecipientExpanded && family?.care_recipient_name ? (
              <Text style={styles.rowValue} numberOfLines={1}>{family.care_recipient_name}</Text>
            ) : null}
            <DisclosureChevron expanded={careRecipientExpanded} color={t.borderLight} size={18} />
          </TouchableOpacity>
          <Collapsible expanded={careRecipientExpanded}>
            <View style={styles.familyCollapsibleInner}>
              <Text style={styles.editFieldLabel}>{tx('settings.family.caringForLabel')}</Text>
              <TextInput
                style={styles.inlineInput}
                value={recipientName}
                onChangeText={setRecipientName}
                placeholder={tx('settings.family.recipientPlaceholder')}
                placeholderTextColor={t.textTertiary}
              />
              <View style={styles.inlineActions}>
                <TouchableOpacity
                  style={styles.inlineCancelBtn}
                  onPress={() => {
                    setRecipientName(family?.care_recipient_name ?? '');
                    setCareRecipientExpanded(false);
                  }}
                >
                  <Text style={styles.inlineCancelText}>{tx('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.inlineSaveBtn, savingCareRecipient && { opacity: 0.6 }]}
                  onPress={saveCareRecipientOnly}
                  disabled={savingCareRecipient}
                >
                  {savingCareRecipient
                    ? <ActivityIndicator color={t.surface} size="small" />
                    : <Text style={styles.inlineSaveText}>{tx('common.save')}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </Collapsible>
        </View>

        {/* ── Preferences ───────────────────────────── */}
        <SectionHeader title={tx('settings.sections.preferences')} />
        <View style={styles.card}>
          <LinkRow
            label={tx('settings.preferences.appearance')}
            sublabel={tx('settings.preferences.appearanceSub')}
            onPress={() => navigation.navigate('Appearance')}
          />
          <Divider />
          <LinkRow
            label={tx('settings.preferences.language')}
            sublabel={tx('settings.preferences.languageSub')}
            onPress={() => navigation.navigate('Language')}
          />
          <Divider />
          <LinkRow
            label={tx('settings.preferences.notifications')}
            sublabel={tx('settings.preferences.notificationsSub')}
            onPress={() => navigation.navigate('Notifications')}
          />
          <Divider />
          <LinkRow
            label={tx('settings.preferences.accessibility')}
            sublabel={tx('settings.preferences.accessibilitySub')}
            onPress={() => navigation.navigate('Accessibility')}
          />
        </View>

        {/* ── Privacy & Data ────────────────────────── */}
        <SectionHeader title={tx('settings.sections.privacy')} />
        <View style={styles.card}>
          <LinkRow
            label={tx('settings.privacy.dataPrivacy')}
            sublabel={tx('settings.privacy.dataPrivacySub')}
            onPress={() => navigation.navigate('DataPrivacy')}
          />
          <Divider />
          <LinkRow
            label={tx('settings.privacy.export')}
            sublabel={tx('settings.privacy.exportSub')}
            onPress={handleExport}
            chevron={!exporting}
          />
          {exporting && (
            <View style={styles.exportingRow}>
              <ActivityIndicator color={t.accent} size="small" />
              <Text style={styles.exportingText}>{tx('settings.privacy.exporting')}</Text>
            </View>
          )}
          <Divider />
          <LinkRow
            label={tx('settings.privacy.deleteAccount')}
            sublabel={tx('settings.privacy.deleteAccountSub')}
            onPress={confirmDeleteAccount}
            danger
            disabled={deletingAccount}
            chevron={!deletingAccount}
            right={deletingAccount ? <ActivityIndicator color={t.error} /> : undefined}
          />
        </View>

        {/* ── About ─────────────────────────────────── */}
        <SectionHeader title={tx('settings.sections.about')} />
        <View style={styles.card}>
          <LinkRow label={tx('settings.about.version')} value={APP_VERSION} onPress={() => {}} chevron={false} />
          <Divider />
          <LinkRow label={tx('settings.about.sendFeedback')} onPress={() => Linking.openURL('mailto:support@kin.care?subject=Kin%20Feedback')} />
          <Divider />
          <LinkRow
            label={tx('settings.about.privacyPolicy')}
            onPress={async () => {
              try {
                await Linking.openURL(PRIVACY_POLICY_URL);
              } catch {
                setShowPrivacy(true);
              }
            }}
          />
          <Divider />
          <LinkRow
            label={tx('settings.about.terms')}
            onPress={async () => {
              try {
                await Linking.openURL(TERMS_OF_SERVICE_URL);
              } catch {
                setShowTerms(true);
              }
            }}
          />
        </View>

        {/* ── Sign Out ──────────────────────────────── */}
        <View style={styles.signOutSection}>
          <TouchableOpacity
            style={[styles.signOutBtn, (signingOut || deletingAccount) && { opacity: 0.65 }]}
            onPress={confirmSignOut}
            activeOpacity={0.7}
            disabled={signingOut || deletingAccount}
          >
            {signingOut
              ? <ActivityIndicator color={t.error} />
              : <Text style={styles.signOutText}>{tx('settings.signOut')}</Text>}
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>{tx('settings.footerTagline')}</Text>
      </ScrollView>

      <PolicyViewer
        visible={showPrivacy}
        title={PRIVACY_POLICY.title}
        lastUpdated={PRIVACY_POLICY.lastUpdated}
        sections={PRIVACY_POLICY.sections}
        onClose={() => setShowPrivacy(false)}
      />
      <PolicyViewer
        visible={showTerms}
        title={TERMS_OF_SERVICE.title}
        lastUpdated={TERMS_OF_SERVICE.lastUpdated}
        sections={TERMS_OF_SERVICE.sections}
        onClose={() => setShowTerms(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20, paddingBottom: 56 },

    sectionHeader: {
      fontSize: 11, fontWeight: '700', color: t.textTertiary,
      textTransform: 'uppercase', letterSpacing: 0.8,
      marginBottom: 8, marginTop: 24, marginLeft: 4,
    },
    card: {
      backgroundColor: t.surface, borderRadius: 16, overflow: 'hidden',
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },

    // Profile
    profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
    avatarWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      overflow: 'hidden',
      position: 'relative',
    },
    avatarSavingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileName: { fontSize: 15, fontWeight: '600', color: t.text },
    profileEmail: { fontSize: 13, color: t.textSecondary, marginTop: 1 },
    editLink: { fontSize: 14, color: t.accent, fontWeight: '600' },

    // Inline edit block
    inlineEdit: { padding: 16, gap: 8 },
    editFieldLabel: { fontSize: 11, fontWeight: '700', color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5 },
    inlineInput: { backgroundColor: t.surfaceAlt, borderRadius: 10, padding: 12, fontSize: 15, color: t.text },
    inlineActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    inlineCancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: t.surfaceAlt, alignItems: 'center' },
    inlineCancelText: { fontSize: 14, fontWeight: '600', color: t.textSecondary },
    inlineSaveBtn: { flex: 1, paddingVertical: 11, borderRadius: 12, backgroundColor: t.accent, alignItems: 'center' },
    inlineSaveText: { fontSize: 14, fontWeight: '700', color: t.surface },

    familyDisclosureRow: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12,
    },
    familyCollapsibleInner: {
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 16,
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.border,
    },

    // Generic rows
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
    rowLabel: { fontSize: 15, color: t.text },
    rowSublabel: { fontSize: 12, color: t.textTertiary, marginTop: 1 },
    rowValue: { fontSize: 15, color: t.textSecondary },
    rowChevron: { fontSize: 20, color: t.borderLight },

    // Export
    exportingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
    exportingText: { fontSize: 13, color: t.textSecondary },

    // Sign out
    signOutSection: { marginTop: 32 },
    signOutBtn: {
      backgroundColor: t.surface, borderRadius: 16, paddingVertical: 16, alignItems: 'center',
      shadowColor: t.shadow, shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    },
    signOutText: { fontSize: 16, fontWeight: '700', color: t.error },
    versionText: { textAlign: 'center', fontSize: 12, color: t.borderLight, marginTop: 24 },
  });
}
