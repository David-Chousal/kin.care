import { useState, useRef, useCallback, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Linking, Animated } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SkeletonList } from '../../components/SkeletonCard';
import { Swipeable } from 'react-native-gesture-handler';
import { hapticImpact, ImpactFeedbackStyle } from '../../lib/haptics';
import { useDocuments, useDeleteDocument } from './hooks/useDocuments';
import { UploadDocumentSheet } from './UploadDocumentSheet';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/Icon';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Document, DocumentCategory } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { useTheme } from '../../theme';
import { EmptyState } from '../../components/EmptyState';

const CATEGORY_META: Record<DocumentCategory, { mci: string; color: string }> = {
  medical: { mci: 'medical-bag', color: '#EF4444' },
  legal: { mci: 'scale-balance', color: '#8B5CF6' },
  insurance: { mci: 'shield-check', color: '#3B82F6' },
  general: { mci: 'folder-outline', color: '#6B7280' },
};

const BUCKET = 'documents';

function SwipeableDocumentCard({ doc, onDelete }: { doc: Document; onDelete: () => void }) {
  const swipeableRef = useRef<Swipeable>(null);
  const meta = CATEGORY_META[doc.category];
  const d = new Date(doc.created_at);

  async function handleOpen() {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(doc.file_path);
    await Linking.openURL(data.publicUrl);
  }

  function renderRightActions(progress: Animated.AnimatedInterpolation<number>) {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
    return (
      <Animated.View style={[styles.swipeDeleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.swipeDeleteBtn}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete();
          }}
        >
          <Icon name="trash" size={20} color="#FFFFFF" />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={60}
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === 'right') {
          hapticImpact(ImpactFeedbackStyle.Medium);
        }
      }}
    >
      <TouchableOpacity style={styles.card} onPress={handleOpen} activeOpacity={0.7}>
        <View style={[styles.iconBadge, { backgroundColor: meta.color + '20' }]}>
          <MaterialCommunityIcons name={meta.mci as never} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{doc.name}</Text>
          <Text style={styles.cardMeta}>
            {doc.category.charAt(0).toUpperCase() + doc.category.slice(1)}
            {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
          </Text>
          <Text style={styles.cardDate}>
            {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <Text style={styles.openLabel}>Open ›</Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

export function DocumentsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: docs, isLoading, isFetching, refetch } = useDocuments();
  const deleteDoc = useDeleteDocument();
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState<DocumentCategory | 'all'>('all');

  const openUpload = useCallback(() => setShowUpload(true), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label="Upload" onPress={openUpload} />,
    });
  }, [navigation, openUpload]);

  const filtered = (docs ?? []).filter(
    (d) => filter === 'all' || d.category === filter
  );
  const docsEmpty = filtered.length === 0;

  function confirmDelete(doc: Document) {
    Alert.alert('Delete Document', `Delete "${doc.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteDoc.mutate({ id: doc.id, filePath: doc.file_path }),
      },
    ]);
  }

  const filterHeader = (
    <View style={styles.filterRow}>
      {(['all', 'medical', 'legal', 'insurance', 'general'] as const).map((key) => (
        <TouchableOpacity
          key={key}
          style={[styles.filterChip, filter === key && styles.filterChipActive]}
          onPress={() => setFilter(key)}
        >
          <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {isLoading ? (
        <View style={{ flex: 1, paddingTop: 12 }}>
          <SkeletonList count={4} lines={3} />
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filtered}
          keyExtractor={(d) => d.id}
          ListHeaderComponent={filterHeader}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, { paddingTop: 12 }, docsEmpty && { flexGrow: 1 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
            ListEmptyComponent={
              <EmptyState
                icon="documents"
                title={filter === 'all' ? 'No documents yet' : `No ${filter} documents yet`}
                message={
                  filter === 'all'
                    ? 'Store medical, legal, and insurance files in one secure place.'
                    : `Nothing in ${filter} yet. Upload a file to add it here.`
                }
                actionLabel={filter === 'all' ? 'Upload your first document' : 'Upload a document'}
                onAction={openUpload}
              />
            }
            renderItem={({ item }) => (
              <SwipeableDocumentCard doc={item} onDelete={() => confirmDelete(item)} />
            )}
        />
      )}

      <UploadDocumentSheet visible={showUpload} onClose={() => setShowUpload(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F7F4' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: '#F3F4F6' },
  filterChipActive: { backgroundColor: '#4F6BED' },
  filterText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '600' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  swipeDeleteAction: {
    width: 80,
    marginBottom: 0,
  },
  swipeDeleteBtn: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeDeleteText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  iconBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconText: { fontSize: 22 },
  cardName: { fontSize: 15, fontWeight: '600', color: '#1A1A2E' },
  cardMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  cardDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  openLabel: { fontSize: 13, color: '#4F6BED', fontWeight: '600' },
});
