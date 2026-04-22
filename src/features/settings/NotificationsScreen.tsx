import { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useTheme, type Theme } from '../../theme';
import { useNotificationPrefs } from '../../store/notifications';
import {
  requestNotificationPermission,
  type NotificationTriggerContext,
} from '../notifications/requestNotificationPermission';

function Divider() {
  const t = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 16 }} />;
}

function ToggleRow({
  label,
  sublabel,
  value,
  onValueChange,
  disabled = false,
  indent = false,
}: {
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  indent?: boolean;
}) {
  const t = useTheme();
  const styles = makeStyles(t);
  return (
    <View style={[styles.row, indent && styles.rowIndent]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.rowLabel, disabled && { color: t.textTertiary }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: t.borderLight, true: t.accent }}
        thumbColor={t.surface}
      />
    </View>
  );
}

export function NotificationsScreen() {
  const t = useTheme();
  const styles = makeStyles(t);
  const notifPrefs = useNotificationPrefs();

  const [permissionStatus, setPermissionStatus] = useState<string>('undetermined');

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermissionStatus(status);
      notifPrefs.syncPermissionStatus(status);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const systemAllowsNotifications = permissionStatus === 'granted' || permissionStatus === 'provisional';

  async function ensurePermission(context: NotificationTriggerContext): Promise<boolean> {
    const granted = await requestNotificationPermission(context, () => {
      // Re-read the OS status so display updates immediately.
      Notifications.getPermissionsAsync().then(({ status }) => setPermissionStatus(status));
    });
    if (!granted) {
      // Reflect any status change even on denial (e.g. user denied in OS dialog).
      Notifications.getPermissionsAsync().then(({ status }) => setPermissionStatus(status));
    }
    return granted;
  }

  async function handleMasterToggle(value: boolean) {
    if (value) {
      const ok = await ensurePermission('settings');
      if (!ok) return;
    }
    notifPrefs.setMasterEnabled(value);
  }

  const notificationsOn = notifPrefs.masterEnabled && systemAllowsNotifications;

  async function handleSubToggle(
    key:
      | 'taskReminders'
      | 'taskAssigned'
      | 'medicationAlerts'
      | 'checkinReminders'
      | 'eventReminders',
    value: boolean,
    context: NotificationTriggerContext,
  ) {
    if (value) {
      const ok = await ensurePermission(context);
      if (!ok) return;
      if (!notifPrefs.masterEnabled) notifPrefs.setMasterEnabled(true);
    }
    switch (key) {
      case 'taskReminders':
        notifPrefs.setTaskReminders(value);
        return;
      case 'taskAssigned':
        notifPrefs.setTaskAssigned(value);
        return;
      case 'medicationAlerts':
        notifPrefs.setMedicationAlerts(value);
        return;
      case 'checkinReminders':
        notifPrefs.setCheckinReminders(value);
        return;
      case 'eventReminders':
        notifPrefs.setEventReminders(value);
        return;
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
          <View style={styles.card}>
            <ToggleRow
              label="Push Notifications"
              sublabel={permissionStatus === 'denied' ? 'Disabled in system Settings' : undefined}
              value={notifPrefs.masterEnabled && systemAllowsNotifications}
              onValueChange={handleMasterToggle}
            />
            <Divider />
            <ToggleRow
              label="Task Reminders"
              value={notifPrefs.taskReminders && notificationsOn}
              onValueChange={(v) => handleSubToggle('taskReminders', v, 'settings')}
              indent
            />
            <Divider />
            <ToggleRow
              label="Task Assigned to Me"
              sublabel="Push when a family member assigns a task to you"
              value={notifPrefs.taskAssigned && notificationsOn}
              onValueChange={(v) => handleSubToggle('taskAssigned', v, 'settings')}
              indent
            />
            <Divider />
            <ToggleRow
              label="Medication Alerts"
              value={notifPrefs.medicationAlerts && notificationsOn}
              onValueChange={(v) => handleSubToggle('medicationAlerts', v, 'medication_alert')}
              indent
            />
            <Divider />
            <ToggleRow
              label="Check-in Reminders"
              value={notifPrefs.checkinReminders && notificationsOn}
              onValueChange={(v) => handleSubToggle('checkinReminders', v, 'settings')}
              indent
            />
            <Divider />
            <ToggleRow
              label="Event Reminders"
              value={notifPrefs.eventReminders && notificationsOn}
              onValueChange={(v) => handleSubToggle('eventReminders', v, 'calendar_reminder')}
              indent
            />
          </View>

          <Text style={styles.footnote}>
            If notifications are disabled at the system level, enable them in your device's Settings.
          </Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20, paddingBottom: 56 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: t.shadow,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
    rowIndent: { paddingLeft: 30 },
    rowLabel: { fontSize: 15, color: t.text },
    rowSublabel: { fontSize: 12, color: t.textTertiary, marginTop: 1 },
    footnote: {
      marginTop: 16,
      marginHorizontal: 4,
      fontSize: 13,
      lineHeight: 18,
      color: t.textSecondary,
    },
  });
}
