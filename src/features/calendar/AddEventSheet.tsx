import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform,
} from 'react-native';
import { FormSheet } from '../../components/FormSheet';
import { FormError } from '../../components/FormError';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from '../../store/auth';
import { useAddCalendarEvent, useUpdateCalendarEvent } from './hooks/useCalendarEvents';
import type { CalendarEvent } from '../../types';
import { useTheme, type Theme } from '../../theme';
import { Icon } from '../../components/Icon';
import { requestNotificationPermission } from '../notifications/requestNotificationPermission';

interface Props {
  visible: boolean;
  onClose: () => void;
  editing?: CalendarEvent;
}

export function AddEventSheet({ visible, onClose, editing }: Props) {
  const t = useTheme();
  const styles = makeStyles(t);
  const { user } = useAuthStore();
  const addEvent = useAddCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [includeTime, setIncludeTime] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setFormError(null);
      if (editing) {
        setTitle(editing.title);
        setDescription(editing.description ?? '');
        setLocation(editing.location ?? '');
        const d = new Date(editing.starts_at);
        setDate(d);
        const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0;
        setIncludeTime(hasTime);
      } else {
        setTitle(''); setDescription(''); setLocation('');
        setDate(new Date()); setIncludeTime(false);
      }
      setShowDatePicker(false); setShowTimePicker(false);
    }
  }, [visible, editing?.id]);

  function reset() {
    setTitle(''); setDescription(''); setLocation('');
    setDate(new Date()); setIncludeTime(false);
    setShowDatePicker(false); setShowTimePicker(false);
    setFormError(null);
  }

  async function handleSubmit() {
    setFormError(null);
    if (!title.trim()) {
      setFormError('Event title is required.');
      return;
    }
    const starts_at = includeTime
      ? date.toISOString()
      : new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();

    if (editing) {
      await updateEvent.mutateAsync({ id: editing.id, title: title.trim(), description: description.trim() || undefined, location: location.trim() || undefined, starts_at });
      reset();
      onClose();
    } else {
      await addEvent.mutateAsync({ title: title.trim(), description: description.trim() || undefined, location: location.trim() || undefined, starts_at, created_by: user!.id });
      // Prompt for notification permission after saving a new event so the user
      // understands why reminders are useful. Closes the sheet first.
      reset();
      onClose();
      await requestNotificationPermission('calendar_reminder');
    }
  }

  const isPending = addEvent.isPending || updateEvent.isPending;
  const dateLabel = date.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <FormSheet
      visible={visible}
      title={editing ? 'Edit Event' : 'New Event'}
      isSubmitting={isPending}
      onClose={() => { reset(); onClose(); }}
      onSubmit={handleSubmit}
    >
        <View style={styles.form}>
          <FormError message={formError} />
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Doctor appointment"
            placeholderTextColor={t.textTertiary}
            value={title}
            onChangeText={(v) => { setTitle(v); setFormError(null); }}
            returnKeyType="next"
            accessibilityLabel="Event title"
            accessibilityState={formError ? { invalid: true } : undefined}
          />

          <Text style={styles.label}>Date</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDatePicker(true)}>
            <Icon name="calendar" size={18} color={t.textSecondary} />
            <Text style={styles.pickerText}>{dateLabel}</Text>
          </TouchableOpacity>

          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (selected) setDate(selected);
              }}
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <TouchableOpacity style={styles.pickerDone} onPress={() => setShowDatePicker(false)}>
              <Text style={styles.pickerDoneText}>Done</Text>
            </TouchableOpacity>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Include Time</Text>
            <TouchableOpacity
              style={[styles.toggle, includeTime && styles.toggleOn]}
              onPress={() => setIncludeTime(!includeTime)}
            >
              <View style={[styles.toggleThumb, includeTime && styles.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {includeTime && (
            <>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTimePicker(true)}>
                <Icon name="clock" size={18} color={t.textSecondary} />
                <Text style={styles.pickerText}>{timeLabel}</Text>
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={date}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, selected) => {
                    if (Platform.OS === 'android') setShowTimePicker(false);
                    if (selected) setDate(selected);
                  }}
                />
              )}
              {Platform.OS === 'ios' && showTimePicker && (
                <TouchableOpacity style={styles.pickerDone} onPress={() => setShowTimePicker(false)}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. St. Mary's Hospital"
            placeholderTextColor={t.textTertiary}
            value={location}
            onChangeText={setLocation}
            returnKeyType="next"
          />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder="Optional notes…"
            placeholderTextColor={t.textTertiary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
          />
        </View>
    </FormSheet>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    form: { padding: 20, gap: 6 },
    label: { fontSize: 13, fontWeight: '600', color: t.textSecondary, marginTop: 16 },
    input: {
      backgroundColor: t.surface, borderRadius: 12, borderWidth: 1,
      borderColor: t.border, paddingHorizontal: 16, paddingVertical: 13,
      fontSize: 15, color: t.text, marginTop: 6,
    },
    multiline: { height: 88, textAlignVertical: 'top', paddingTop: 13 },
    pickerButton: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      backgroundColor: t.surface, borderRadius: 12, borderWidth: 1,
      borderColor: t.border, paddingHorizontal: 16, paddingVertical: 13, marginTop: 6,
    },
    pickerText: { fontSize: 15, color: t.text },
    pickerDone: { alignItems: 'flex-end', paddingTop: 8 },
    pickerDoneText: { fontSize: 15, color: t.accent, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
    toggle: {
      width: 48, height: 28, borderRadius: 14, backgroundColor: t.border,
      justifyContent: 'center', paddingHorizontal: 2,
    },
    toggleOn: { backgroundColor: t.accent },
    toggleThumb: {
      width: 24, height: 24, borderRadius: 12, backgroundColor: t.surface,
      shadowColor: t.shadow, shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    },
    toggleThumbOn: { alignSelf: 'flex-end' },
  });
}
