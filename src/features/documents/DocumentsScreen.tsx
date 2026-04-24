import { useMemo, useState, useCallback, useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Linking, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { SkeletonList } from '../../components/SkeletonCard';
import { SwipeToDelete } from '../../components/SwipeToDelete';
import {
  useDocuments,
  useDeleteDocument,
  DOCUMENTS_BUCKET,
  DOCUMENTS_SIGNED_URL_EXPIRY_SEC,
} from './hooks/useDocuments';
import { UploadDocumentSheet } from './UploadDocumentSheet';
import { supabase } from '../../lib/supabase';
import { Icon } from '../../components/Icon';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { Document, DocumentCategory } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { useTheme, type Theme, spacing } from '../../theme';
import { EmptyState } from '../../components/EmptyState';
import { UndoSnackbar } from '../../components/UndoSnackbar';
import { useUndoDelete } from '../../hooks/useUndoDelete';
import { errorMessageFromUnknown } from '../../lib/errorMessage';
import { useEffectiveTier } from '../../subscription/useEffectiveTier';
import { featureUnlocked } from '../../subscription/featureTierConfig';
import { FeatureLockedCallout } from '../../subscription/FeatureLockedCallout';
import { useFormatLocaleTag } from '../../i18n/useFormatLocaleTag';

function categoryMeta(t: Theme): Record<DocumentCategory, { mci: string; color: string }> {
  return {
    medical: { mci: 'medical-bag', color: t.error },
    legal: { mci: 'scale-balance', color: t.accent },
    insurance: { mci: 'shield-check', color: t.info },
    general: { mci: 'folder-outline', color: t.textSecondary },
  };
}

function SwipeableDocumentCard({
  doc,
  onDelete,
  t,
  styles,
}: {
  doc: Document;
  onDelete: () => void;
  t: Theme;
  styles: ReturnType<typeof makeStyles>;
}) {
  const { t: tx } = useTranslation();
  const meta = categoryMeta(t)[doc.category];
  const formatLocale = useFormatLocaleTag();
  const d = new Date(doc.created_at);

  async function handleOpen() {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.file_path, DOCUMENTS_SIGNED_URL_EXPIRY_SEC);
    if (error || !data?.signedUrl) {
      Alert.alert(tx('documents.errors.openFailedTitle'), error?.message ?? tx('common.pleaseTryAgain'));
      return;
    }
    try {
      await Linking.openURL(data.signedUrl);
    } catch {
      Alert.alert(tx('documents.errors.openFailedTitle'), tx('documents.errors.noAppBody'));
    }
  }

  return (
    <SwipeToDelete
      onDelete={onDelete}
      accessibilityLabel={
        doc.name?.trim()
          ? tx('documents.a11y.documentLabel', { name: doc.name.trim() })
          : tx('documents.a11y.documentLabelNoName')
      }
    >
      <TouchableOpacity style={styles.card} onPress={handleOpen} activeOpacity={0.7}>
        <View style={[styles.iconBadge, { backgroundColor: meta.color + '20' }]}>
          <MaterialCommunityIcons name={meta.mci as never} size={22} color={meta.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{doc.name}</Text>
          <Text style={styles.cardMeta}>
            {tx(`documents.categories.${doc.category}`)}
            {doc.file_size ? ` · ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
          </Text>
          <Text style={styles.cardDate}>
            {d.toLocaleDateString(formatLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        <Text style={styles.openLabel}>{tx('common.open')} ›</Text>
      </TouchableOpacity>
    </SwipeToDelete>
  );
}

export function DocumentsScreen() {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { t: tx } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: tier = 'free' } = useEffectiveTier();
  const vaultLocked = !featureUnlocked(tier, 'document_vault');
  const { data: docs, isLoading, isFetching, refetch } = useDocuments();
  const deleteDoc = useDeleteDocument();
  const undoDelete = useUndoDelete();
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState<DocumentCategory | 'all'>('all');

  const openUpload = useCallback(() => setShowUpload(true), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: vaultLocked
        ? undefined
        : () => <NativeHeaderTextButton label={tx('common.upload')} onPress={openUpload} />,
    });
  }, [navigation, openUpload, vaultLocked, tx]);

  const filtered = (docs ?? []).filter(
    (d) => filter === 'all' || d.category === filter
  );
  const docsEmpty = filtered.length === 0;

  function confirmDelete(doc: Document) {
    const name = doc.name?.trim() || tx('common.document');
    undoDelete.scheduleDelete(tx('common.removed', { item: name }), () =>
      deleteDoc.mutate(
        { id: doc.id, filePath: doc.file_path },
        {
          onError: (err) => {
            Alert.alert(tx('documents.errors.deleteFailedTitle'), errorMessageFromUnknown(err));
          },
        },
      ),
    );
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
            {key === 'all' ? tx('documents.filters.all') : tx(`documents.categories.${key}`)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  if (vaultLocked) {
    return (
      <View style={[styles.container, { paddingTop: spacing.md }]}>
        <FeatureLockedCallout
          featureId="document_vault"
          currentTier={tier}
          onUpgrade={() => navigation.navigate('Subscription', { featureId: 'document_vault' })}
          showNativePurchaseCta={Platform.OS !== 'web'}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
                title={
                  filter === 'all'
                    ? tx('documents.empty.all.title')
                    : tx('documents.empty.filtered.title', { category: tx(`documents.categories.${filter}`) })
                }
                message={
                  filter === 'all'
                    ? tx('documents.empty.all.message')
                    : tx('documents.empty.filtered.message', { category: tx(`documents.categories.${filter}`) })
                }
                actionLabel={filter === 'all' ? tx('documents.empty.all.action') : tx('documents.empty.filtered.action')}
                onAction={openUpload}
              />
            }
            renderItem={({ item }) => (
              <SwipeableDocumentCard doc={item} onDelete={() => confirmDelete(item)} t={t} styles={styles} />
            )}
        />
      )}

      <UploadDocumentSheet visible={showUpload} onClose={() => setShowUpload(false)} />

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
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 8,
      backgroundColor: 'transparent',
    },
    filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: t.surfaceAlt },
    filterChipActive: { backgroundColor: t.accent },
    filterText: { fontSize: 12, color: t.textSecondary, fontWeight: '500' },
    filterTextActive: { color: t.surface, fontWeight: '600' },
    list: { padding: 16, gap: 10, paddingBottom: 40 },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.surface,
      borderRadius: 14,
      padding: 14,
      gap: 12,
      shadowColor: t.shadow,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    iconBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardName: { fontSize: 15, fontWeight: '600', color: t.text },
    cardMeta: { fontSize: 12, color: t.textSecondary, marginTop: 2 },
    cardDate: { fontSize: 11, color: t.textTertiary, marginTop: 2 },
    openLabel: { fontSize: 13, color: t.accent, fontWeight: '600' },
  });
}
