import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme';
import { useFamilyStore } from '../../store/family';
import { useAuthStore } from '../../store/auth';
import { useMembers } from '../family/hooks/useMembers';
import { useClearAllVisitPrepSummaries } from '../visitprep/useVisitPrepMutations';
import { useClearAllHealthLogs } from '../health/hooks/useHealthLogs';
import { errorMessageFromUnknown } from '../../lib/errorMessage';

function SectionHeader({ title }: { title: string }) {
  const t = useTheme();
  const styles = makeStyles(t);
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

export function DataPrivacyScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const family = useFamilyStore((s) => s.family);
  const user = useAuthStore((s) => s.user);
  const { data: members = [] } = useMembers(family?.id ?? '');
  const isFamilyAdmin = members.some((m) => m.user_id === user?.id && m.role === 'admin');

  const clearVisitPrep = useClearAllVisitPrepSummaries();
  const clearHealthLogs = useClearAllHealthLogs();

  const busy = clearVisitPrep.isPending || clearHealthLogs.isPending;

  function confirmClearVisitPrep() {
    if (!isFamilyAdmin) {
      Alert.alert(tx('settings.dataPrivacy.alerts.adminsOnly.title'), tx('settings.dataPrivacy.alerts.adminsOnly.visitPrepBody'));
      return;
    }
    Alert.alert(
      tx('settings.dataPrivacy.alerts.confirmClearVisitPrep.title'),
      tx('settings.dataPrivacy.alerts.confirmClearVisitPrep.body'),
      [
        { text: tx('common.cancel'), style: 'cancel' },
        {
          text: tx('common.clearAll'),
          style: 'destructive',
          onPress: () => {
            clearVisitPrep.mutate(undefined, {
              onSuccess: () => Alert.alert(tx('common.done'), tx('settings.dataPrivacy.alerts.clearedVisitPrep')),
              onError: (e) => Alert.alert(tx('settings.dataPrivacy.alerts.couldNotClear'), errorMessageFromUnknown(e)),
            });
          },
        },
      ]
    );
  }

  function confirmClearHealthLogs() {
    if (!isFamilyAdmin) {
      Alert.alert(tx('settings.dataPrivacy.alerts.adminsOnly.title'), tx('settings.dataPrivacy.alerts.adminsOnly.healthBody'));
      return;
    }
    Alert.alert(
      tx('settings.dataPrivacy.alerts.confirmClearHealthLogs.title'),
      tx('settings.dataPrivacy.alerts.confirmClearHealthLogs.body'),
      [
        { text: tx('common.cancel'), style: 'cancel' },
        {
          text: tx('common.clearAll'),
          style: 'destructive',
          onPress: () => {
            clearHealthLogs.mutate(undefined, {
              onSuccess: () => Alert.alert(tx('common.done'), tx('settings.dataPrivacy.alerts.clearedHealthLogs')),
              onError: (e) => Alert.alert(tx('settings.dataPrivacy.alerts.couldNotClear'), errorMessageFromUnknown(e)),
            });
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: t.textSecondary }]}>{tx('settings.dataPrivacy.intro')}</Text>

        {!isFamilyAdmin ? (
          <View style={[styles.notice, { backgroundColor: t.surface, borderColor: t.borderLight }]}>
            <Text style={[styles.noticeText, { color: t.textSecondary }]}>
              {tx('settings.dataPrivacy.notAdminNotice')}
            </Text>
          </View>
        ) : null}

        <SectionHeader title={tx('settings.dataPrivacy.sectionHeader')} />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={confirmClearVisitPrep}
            disabled={busy || !family}
            activeOpacity={0.6}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.rowLabel, { color: t.error }]}>{tx('settings.dataPrivacy.rows.clearVisitPrep.label')}</Text>
              <Text style={styles.rowSublabel}>{tx('settings.dataPrivacy.rows.clearVisitPrep.sublabel')}</Text>
            </View>
            {clearVisitPrep.isPending ? <ActivityIndicator color={t.accent} /> : <Text style={styles.rowChevron}>›</Text>}
          </TouchableOpacity>
          <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 16 }} />
          <TouchableOpacity
            style={styles.row}
            onPress={confirmClearHealthLogs}
            disabled={busy || !family}
            activeOpacity={0.6}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.rowLabel, { color: t.error }]}>{tx('settings.dataPrivacy.rows.clearHealthLogs.label')}</Text>
              <Text style={styles.rowSublabel}>{tx('settings.dataPrivacy.rows.clearHealthLogs.sublabel')}</Text>
            </View>
            {clearHealthLogs.isPending ? <ActivityIndicator color={t.accent} /> : <Text style={styles.rowChevron}>›</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20, paddingBottom: 56, gap: 16 },
    sectionHeader: {
      fontSize: 11,
      fontWeight: '700',
      color: t.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginLeft: 4,
    },
    intro: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
    notice: {
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
    },
    noticeText: { fontSize: 14, lineHeight: 20 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: t.shadow,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      gap: 12,
    },
    rowLabel: { fontSize: 16, fontWeight: '600' },
    rowSublabel: { fontSize: 13, color: t.textSecondary, lineHeight: 18 },
    rowChevron: { fontSize: 22, color: t.textTertiary, fontWeight: '300' },
  });
}
