import { useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Image, Alert, Modal } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { showActionSheet } from '../../lib/actionSheet';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import { SkeletonList } from '../../components/SkeletonCard';
import { useHealthLogs, useDeleteHealthLog, useHealthLogPhotoUrl } from './hooks/useHealthLogs';
import { HealthLogTrendSection } from './HealthLogTrendSection';
import { AddHealthLogSheet } from './AddHealthLogSheet';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HealthLog, HealthLogCategory } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { errorMessageFromUnknown } from '../../lib/errorMessage';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

const CATEGORY_META: Record<HealthLogCategory, { mci: string; color: string }> = {
  symptom: { mci: 'thermometer',       color: '#F59E0B' },
  vital:   { mci: 'heart-pulse',       color: '#EF4444' },
  mood:    { mci: 'emoticon-happy-outline', color: '#10B981' },
  note:    { mci: 'note-text-outline', color: '#6B7280' },
};

const FILTER_OPTIONS: Array<{ key: HealthLogCategory | 'all'; labelKey: string }> = [
  { key: 'all', labelKey: 'health.filters.all' },
  { key: 'symptom', labelKey: 'health.filters.symptoms' },
  { key: 'vital', labelKey: 'health.filters.vitals' },
  { key: 'mood', labelKey: 'health.filters.mood' },
  { key: 'note', labelKey: 'health.filters.notes' },
];

function LogCard({
  log,
  onMenu,
  onPhoto,
  onViewPhoto,
}: {
  log: HealthLog;
  onMenu: () => void;
  onPhoto: () => void;
  onViewPhoto: (photoUri: string) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const formatLocale = useFormatLocaleTag();
  const meta = CATEGORY_META[log.category];
  const d = new Date(log.logged_at);
  const { data: photoUri } = useHealthLogPhotoUrl(log.photo_path);
  return (
    <View style={styles.card}>
      <View style={[styles.iconBadge, { backgroundColor: meta.color + '20' }]}>
        <MaterialCommunityIcons name={meta.mci as never} size={22} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.cardTitle}>{log.title}</Text>
        {log.value ? (
          <Text style={styles.cardValue}>
            {log.value}{log.unit ? ` ${log.unit}` : ''}
          </Text>
        ) : null}
        {log.notes ? (
          <Text style={styles.cardNotes} numberOfLines={2}>{log.notes}</Text>
        ) : null}
        {photoUri ? (
          <TouchableOpacity
            onPress={() => onViewPhoto(photoUri)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={tx('health.a11y.viewPhoto')}
            style={styles.photoThumbButton}
          >
            <Image source={{ uri: photoUri }} style={styles.photoThumb} resizeMode="cover" />
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardDate}>
          {d.toLocaleDateString(formatLocale, { month: 'short', day: 'numeric' })}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={onPhoto}
            style={styles.cardCameraBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={photoUri ? tx('health.a11y.changePhoto') : tx('health.a11y.addPhoto')}
          >
            <MaterialCommunityIcons name="camera-plus-outline" size={22} color={t.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onMenu}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={tx('health.a11y.entryOptions')}
          >
            <Text style={styles.menuDots}>···</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export function HealthLogScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const { t: tx } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: logs, isLoading, isFetching, refetch } = useHealthLogs();
  const deleteLog = useDeleteHealthLog();
  const undoDelete = useUndoDelete();
  const [showAdd, setShowAdd] = useState(false);
  const [editingLog, setEditingLog] = useState<HealthLog | undefined>(undefined);
  const [photoPickerNonce, setPhotoPickerNonce] = useState(0);
  const [filter, setFilter] = useState<HealthLogCategory | 'all'>('all');
  const [viewingPhotoUri, setViewingPhotoUri] = useState<string | null>(null);

  const openAdd = useCallback(() => {
    setEditingLog(undefined);
    setPhotoPickerNonce(0);
    setShowAdd(true);
  }, []);

  const openEditWithPhotoPicker = useCallback((log: HealthLog) => {
    setEditingLog(log);
    setShowAdd(true);
    setPhotoPickerNonce((n) => n + 1);
  }, []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label={tx('common.add')} onPress={openAdd} />,
    });
  }, [navigation, openAdd, tx]);

  function showMenu(log: HealthLog) {
    showActionSheet(
      {
        options: [tx('common.cancel'), tx('common.edit'), tx('common.delete')],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 0,
      },
      (i) => {
        if (i === 1) { setEditingLog(log); setShowAdd(true); }
        if (i === 2) confirmDelete(log);
      }
    );
  }

  function confirmDelete(log: HealthLog) {
    const title = log.title?.trim() || tx('common.entry');
    undoDelete.scheduleDelete(tx('common.removed', { item: title }), () =>
      deleteLog.mutate(log.id, {
        onError: (err) => {
          Alert.alert(tx('health.errors.deleteFailedTitle'), errorMessageFromUnknown(err));
        },
      }),
    );
  }

  const filtered = (logs ?? []).filter((l) => filter === 'all' || l.category === filter);
  const filterEmpty = filtered.length === 0;

  const emptyTitle =
    filter === 'all'
      ? tx('health.empty.all.title')
      : filter === 'symptom'
        ? tx('health.empty.symptoms.title')
        : filter === 'vital'
          ? tx('health.empty.vitals.title')
          : filter === 'mood'
            ? tx('health.empty.mood.title')
            : tx('health.empty.notes.title');

  const emptyMessage =
    filter === 'all'
      ? tx('health.empty.all.message')
      : filter === 'symptom'
        ? tx('health.empty.symptoms.message')
        : filter === 'vital'
          ? tx('health.empty.vitals.message')
          : filter === 'mood'
            ? tx('health.empty.mood.message')
            : tx('health.empty.notes.message');

  const filterHeader = (
    <View style={styles.filterRow}>
      {FILTER_OPTIONS.map(({ key, labelKey }) => (
        <TouchableOpacity
          key={key}
          style={[styles.filterChip, filter === key && styles.filterChipActive]}
          onPress={() => setFilter(key)}
        >
          <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{tx(labelKey)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const listHeader = (
    <View>
      <HealthLogTrendSection />
      {filterHeader}
    </View>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <SkeletonList count={5} lines={3} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(l) => l.id}
          ListHeaderComponent={listHeader}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingTop: 12 }, filterEmpty && { flexGrow: 1 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="health"
                title={emptyTitle}
                message={emptyMessage}
                actionLabel={filter === 'all' ? tx('health.empty.actions.first') : tx('health.empty.actions.add')}
                onAction={openAdd}
              />
            }
            renderItem={({ item }) => (
              <SwipeToDelete
                onDelete={() => confirmDelete(item)}
                accessibilityLabel={item.title?.trim() || tx('health.a11y.entryFallback')}
              >
                <LogCard
                  log={item}
                  onMenu={() => showMenu(item)}
                  onPhoto={() => openEditWithPhotoPicker(item)}
                  onViewPhoto={(uri) => setViewingPhotoUri(uri)}
                />
              </SwipeToDelete>
            )}
        />
      )}

      <Modal
        visible={!!viewingPhotoUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhotoUri(null)}
      >
        <TouchableOpacity
          style={styles.photoModalBackdrop}
          activeOpacity={1}
          onPress={() => setViewingPhotoUri(null)}
          accessibilityRole="button"
          accessibilityLabel={tx('health.a11y.closePhoto')}
        >
          <View style={styles.photoModalCard}>
            {viewingPhotoUri ? (
              <Image source={{ uri: viewingPhotoUri }} style={styles.photoModalImage} resizeMode="contain" />
            ) : null}
          </View>
        </TouchableOpacity>
      </Modal>

      <AddHealthLogSheet
        visible={showAdd}
        editing={editingLog}
        photoPickerNonce={photoPickerNonce}
        onClose={() => { setShowAdd(false); setEditingLog(undefined); setPhotoPickerNonce(0); }}
      />

      <UndoSnackbar
        message={undoDelete.message}
        visible={undoDelete.visible}
        onUndo={undoDelete.undo}
        onSwipeDismiss={undoDelete.dismissAndCommit}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 0,
      paddingVertical: 12,
      gap: 8,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: t.surfaceAlt,
    },
    filterChipActive: { backgroundColor: t.accent },
    filterText: { fontSize: 13, color: t.textSecondary, fontWeight: '500' },
    filterTextActive: { color: t.surface, fontWeight: '600' },
    list: { padding: 16, gap: 10, paddingBottom: 40 },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: t.surface,
      borderRadius: 14,
      padding: 14,
      gap: 12,
      shadowColor: t.shadow,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitle: { fontSize: 15, fontWeight: '600', color: t.text },
    cardValue: { fontSize: 14, color: t.accent, fontWeight: '600', marginTop: 2 },
    cardNotes: { fontSize: 13, color: t.textTertiary, marginTop: 4 },
    photoThumbButton: {
      width: 64,
      height: 64,
      borderRadius: 12,
      marginTop: 8,
      backgroundColor: t.surfaceAlt,
      overflow: 'hidden',
    },
    photoThumb: {
      width: '100%',
      height: '100%',
      backgroundColor: t.surfaceAlt,
    },
    cardRight: { alignItems: 'flex-end', gap: 6 },
    cardDate: { fontSize: 12, color: t.textTertiary },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    cardCameraBtn: {
      padding: 4,
      borderRadius: 8,
      backgroundColor: t.accentLight,
    },
    menuDots: { fontSize: 16, color: t.textTertiary },
    photoModalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.88)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 18,
    },
    photoModalCard: {
      width: '100%',
      maxWidth: 560,
      height: '80%',
      borderRadius: 16,
      backgroundColor: t.surface,
      overflow: 'hidden',
    },
    photoModalImage: {
      width: '100%',
      height: '100%',
      backgroundColor: t.surfaceAlt,
    },
  });
}
