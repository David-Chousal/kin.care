import { useRef, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Animated, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { showActionSheet } from '../../lib/actionSheet';
import { Swipeable } from 'react-native-gesture-handler';
import { SkeletonList } from '../../components/SkeletonCard';
import { useFamilyDoctors, useDeleteFamilyDoctor } from './hooks/useFamilyDoctors';
import { useMedications } from '../medications/hooks/useMedications';
import { AddDoctorSheet } from './AddDoctorSheet';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import type { FamilyDoctor } from '../../types';
import type { MainStackParamList } from '../../navigation/types';
import { NativeHeaderTextButton } from '../../navigation/NativeHeaderTextButton';
import { EmptyState } from '../../components/EmptyState';

function formatAppt(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

function DoctorCard({
  item,
  medLabels,
  onMenu,
  onOpenMed,
}: {
  item: FamilyDoctor;
  medLabels: { id: string; name: string }[];
  onMenu: () => void;
  onOpenMed: (id: string) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);

  function dial() {
    if (!item.phone?.trim()) return;
    const raw = item.phone.replace(/[^\d+]/g, '');
    const url = raw.startsWith('+') || raw.length >= 10 ? `tel:${raw}` : `tel:${item.phone}`;
    Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Icon name="doctor" size={22} color={t.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
          <TouchableOpacity onPress={onMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.menuDots}>···</Text>
          </TouchableOpacity>
        </View>
        {item.specialty ? (
          <Text style={styles.cardSpecialty} numberOfLines={2}>{item.specialty}</Text>
        ) : null}
        {item.phone ? (
          <TouchableOpacity onPress={dial} activeOpacity={0.7}>
            <View style={styles.metaRow}>
              <Icon name="phone" size={14} color={t.textTertiary} />
              <Text style={styles.phoneLink} numberOfLines={1}>{item.phone}</Text>
            </View>
          </TouchableOpacity>
        ) : null}
        {item.address ? (
          <View style={[styles.metaRow, { marginTop: 4 }]}>
            <Icon name="location" size={14} color={t.textTertiary} />
            <Text style={styles.cardMeta} numberOfLines={3}>{item.address}</Text>
          </View>
        ) : null}
        {item.next_appointment_at ? (
          <View style={[styles.metaRow, { marginTop: 6 }]}>
            <Icon name="calendar" size={14} color={t.textSecondary} />
            <Text style={styles.apptText}>{formatAppt(item.next_appointment_at)}</Text>
          </View>
        ) : null}
        {medLabels.length > 0 ? (
          <View style={styles.medRow}>
            <Text style={styles.linkedLabel}>Meds</Text>
            <View style={styles.medLinks}>
              {medLabels.map(({ id, name }) => (
                <TouchableOpacity
                  key={id}
                  style={styles.medPill}
                  onPress={() => onOpenMed(id)}
                >
                  <Icon name="medications" size={12} color={t.accent} />
                  <Text style={styles.medPillText} numberOfLines={1}>{name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SwipeableDoctorCard(props: {
  item: FamilyDoctor;
  medLabels: { id: string; name: string }[];
  onDelete: () => void;
  onMenu: () => void;
  onOpenMed: (id: string) => void;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  const swipeableRef = useRef<Swipeable>(null);
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [80, 0] });
    return (
      <Animated.View style={[styles.swipeDeleteAction, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          style={styles.swipeDeleteBtn}
          onPress={() => { swipeableRef.current?.close(); props.onDelete(); }}
        >
          <Icon name="trash" size={20} color={t.surface} />
          <Text style={styles.swipeDeleteText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} rightThreshold={40}>
      <DoctorCard
        item={props.item}
        medLabels={props.medLabels}
        onMenu={props.onMenu}
        onOpenMed={props.onOpenMed}
      />
    </Swipeable>
  );
}

export function DoctorsScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { data: doctors, isLoading, isFetching, refetch } = useFamilyDoctors();
  const { data: medications = [] } = useMedications();
  const deleteDoctor = useDeleteFamilyDoctor();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<FamilyDoctor | undefined>(undefined);

  const medNameById = useMemo(
    () => new Map(medications.map((m) => [m.id, m.name])),
    [medications],
  );

  const openAdd = useCallback(() => setShowAdd(true), []);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <NativeHeaderTextButton label="Add" onPress={openAdd} />,
    });
  }, [navigation, openAdd]);

  function medLabelsFor(doc: FamilyDoctor): { id: string; name: string }[] {
    return (doc.linked_medication_ids ?? []).flatMap((id) => {
      const name = medNameById.get(id);
      return name ? [{ id, name }] : [];
    });
  }

  function showMenu(doc: FamilyDoctor) {
    showActionSheet(
      { options: ['Cancel', 'Edit', 'Delete'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) { setEditing(doc); setShowAdd(true); }
        if (i === 2) confirmDelete(doc);
      },
    );
  }

  function confirmDelete(doc: FamilyDoctor) {
    Alert.alert('Remove Doctor', `Remove ${doc.name} from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteDoctor.mutate(doc.id) },
    ]);
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
          data={doctors ?? []}
          keyExtractor={(d) => d.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[styles.list, (doctors?.length ?? 0) === 0 && { flexGrow: 1 }]}
          refreshing={isFetching && !isLoading}
          onRefresh={refetch}
          ListEmptyComponent={(
            <EmptyState
              icon="doctor"
              title="No doctors yet"
              message="Save names, specialties, contact info, and next visits. Link medications so everyone knows who prescribes what."
              actionLabel="Add a doctor"
              onAction={openAdd}
            />
          )}
          renderItem={({ item }) => (
            <SwipeableDoctorCard
              item={item}
              medLabels={medLabelsFor(item)}
              onDelete={() => confirmDelete(item)}
              onMenu={() => showMenu(item)}
              onOpenMed={(id) => navigation.navigate('MedicationDetail', { medicationId: id })}
            />
          )}
        />
      )}

      <AddDoctorSheet
        visible={showAdd}
        editing={editing}
        onClose={() => { setShowAdd(false); setEditing(undefined); }}
      />
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    list: { padding: 16, gap: 12, paddingBottom: 40 },
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
    cardIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: t.accentLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: t.text },
    menuDots: { fontSize: 16, color: t.textTertiary },
    cardSpecialty: { fontSize: 14, color: t.textSecondary, marginTop: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 6 },
    cardMeta: { flex: 1, fontSize: 13, color: t.textTertiary, lineHeight: 18 },
    phoneLink: { flex: 1, fontSize: 14, color: t.accent, fontWeight: '600' },
    apptText: { flex: 1, fontSize: 13, fontWeight: '600', color: t.text },
    linkedLabel: { fontSize: 11, fontWeight: '700', color: t.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 8 },
    medRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 12, flexWrap: 'wrap' },
    medLinks: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    medPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: t.accentLight,
      maxWidth: '100%',
    },
    medPillText: { fontSize: 12, fontWeight: '600', color: t.accent, maxWidth: 160 },
    swipeDeleteAction: {
      width: 80,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: t.error,
      borderRadius: 14,
    },
    swipeDeleteBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center', gap: 4 },
    swipeDeleteText: { color: t.surface, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  });
}
