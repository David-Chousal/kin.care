import { useRef, useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Animated, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showActionSheet } from '../../lib/actionSheet';
import { Swipeable } from 'react-native-gesture-handler';
import { SkeletonList } from '../../components/SkeletonCard';
import { useHealthLogs, useDeleteHealthLog, healthLogPhotoPublicUrl } from './hooks/useHealthLogs';
import { HealthLogTrendSection } from './HealthLogTrendSection';
import { AddHealthLogSheet } from './AddHealthLogSheet';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { HealthLog, HealthLogCategory } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';

const CATEGORY_META: Record<HealthLogCategory, { mci: string; color: string }> = {
  symptom: { mci: 'thermometer',       color: '#F59E0B' },
  vital:   { mci: 'heart-pulse',       color: '#EF4444' },
  mood:    { mci: 'emoticon-happy-outline', color: '#10B981' },
  note:    { mci: 'note-text-outline', color: '#6B7280' },
};

const FILTER_OPTIONS: Array<{ key: HealthLogCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'symptom', label: 'Symptoms' },
  { key: 'vital', label: 'Vitals' },
  { key: 'mood', label: 'Mood' },
  { key: 'note', label: 'Notes' },
];

function SwipeableLogCard({ log, onDelete, onMenu }: { log: HealthLog; onDelete: () => void; onMenu: () => void }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const swipeableRef = useRef<Swipeable>(null);
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
    return (
      <Animated.View style={[styles.swipeDeleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.swipeDeleteBtn}
          onPress={() => { swipeableRef.current?.close(); onDelete(); }}
        >
          <Icon name="trash" size={20} color={t.surface} />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} rightThreshold={40}>
      <LogCard log={log} onMenu={onMenu} />
    </Swipeable>
  );
}

function LogCard({ log, onMenu }: { log: HealthLog; onMenu: () => void }) {
  const t = useTheme();
  const styles = makeStyles(t);
  const meta = CATEGORY_META[log.category];
  const d = new Date(log.logged_at);
  const photoUri = healthLogPhotoPublicUrl(log.photo_path);
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
          <Image source={{ uri: photoUri }} style={styles.cardPhoto} resizeMode="cover" />
        ) : null}
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.cardDate}>
          {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuDots}>···</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function HealthLogScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: logs, isLoading, isFetching, refetch } = useHealthLogs();
  const deleteLog = useDeleteHealthLog();
  const [showAdd, setShowAdd] = useState(false);
  const [editingLog, setEditingLog] = useState<HealthLog | undefined>(undefined);
  const [filter, setFilter] = useState<HealthLogCategory | 'all'>('all');

  const openAdd = useCallback(() => setShowAdd(true), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label="Add" onPress={openAdd} />,
    });
  }, [navigation, openAdd]);

  function showMenu(log: HealthLog) {
    showActionSheet(
      { options: ['Cancel', 'Edit', 'Delete'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) { setEditingLog(log); setShowAdd(true); }
        if (i === 2) confirmDelete(log);
      }
    );
  }

  function confirmDelete(log: HealthLog) {
    Alert.alert('Delete Entry', `Delete "${log.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteLog.mutate(log.id) },
    ]);
  }

  const filtered = (logs ?? []).filter((l) => filter === 'all' || l.category === filter);
  const filterEmpty = filtered.length === 0;

  const emptyTitle =
    filter === 'all'
      ? 'No entries yet'
      : filter === 'symptom'
        ? 'No symptoms yet'
        : filter === 'vital'
          ? 'No vitals yet'
          : filter === 'mood'
            ? 'No mood entries yet'
            : 'No notes yet';

  const emptyMessage =
    filter === 'all'
      ? 'Log symptoms, vitals, mood, or notes to spot patterns over time.'
      : filter === 'symptom'
        ? 'Nothing logged here yet. Add a symptom when something changes.'
        : filter === 'vital'
          ? 'Nothing logged here yet. Add a vital when you have a reading.'
          : filter === 'mood'
            ? 'Nothing logged here yet. Capture how the day felt.'
            : 'Nothing logged here yet. Jot a quick note for the team.';

  const filterHeader = (
    <View style={styles.filterRow}>
      {FILTER_OPTIONS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={[styles.filterChip, filter === key && styles.filterChipActive]}
          onPress={() => setFilter(key)}
        >
          <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
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
                actionLabel={filter === 'all' ? 'Add your first entry' : 'Add entry'}
                onAction={openAdd}
              />
            }
            renderItem={({ item }) => <SwipeableLogCard log={item} onDelete={() => confirmDelete(item)} onMenu={() => showMenu(item)} />}
        />
      )}

      <AddHealthLogSheet
        visible={showAdd}
        editing={editingLog}
        onClose={() => { setShowAdd(false); setEditingLog(undefined); }}
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
    cardPhoto: {
      width: '100%',
      height: 112,
      borderRadius: 10,
      marginTop: 8,
      backgroundColor: t.surfaceAlt,
    },
    cardRight: { alignItems: 'flex-end', gap: 6 },
    cardDate: { fontSize: 12, color: t.textTertiary },
    menuDots: { fontSize: 16, color: t.textTertiary },
    swipeDeleteAction: { width: 80, justifyContent: 'center', alignItems: 'center', backgroundColor: t.error, borderRadius: 14, marginBottom: 0 },
    swipeDeleteBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 4 },
    swipeDeleteText: { color: t.surface, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  });
}
