import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import { HomeScreen } from '../features/home/HomeScreen';
import { TaskBoardScreen } from '../features/tasks/TaskBoardScreen';
import { CalendarScreen } from '../features/calendar/CalendarScreen';
import { VisitPrepScreen } from '../features/visitprep/VisitPrepScreen';
import { DoctorsScreen } from '../features/doctors/DoctorsScreen';
import { MedicationListScreen } from '../features/medications/MedicationListScreen';
import { HealthLogScreen } from '../features/health/HealthLogScreen';
import { DocumentsScreen } from '../features/documents/DocumentsScreen';
import { CheckInScreen } from '../features/checkins/CheckInScreen';
import { MemberListScreen } from '../features/family/MemberListScreen';
import { InviteMemberScreen } from '../features/family/InviteMemberScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { AccessibilityScreen } from '../features/settings/AccessibilityScreen';
import { NotificationsScreen } from '../features/settings/NotificationsScreen';
import { AppearanceScreen } from '../features/settings/AppearanceScreen';
import { LanguageScreen } from '../features/settings/LanguageScreen';
import { DataPrivacyScreen } from '../features/settings/DataPrivacyScreen';
import { NotesScreen } from '../features/notes/NotesScreen';
import { MedicationDetailRoute } from './MedicationDetailRoute';
import { useReduceMotion } from './useReduceMotion';
import type { MainStackParamList } from './types';
import { nativePushHeaderScreenOptions } from './nativeStackHeaderTheme';

const Stack = createNativeStackNavigator<MainStackParamList>();

/**
 * Home uses a custom scroll-linked frosted bar (`HomeScreen` + `HeaderFrostedBackdrop`), not
 * the native-stack header — intentionally exempt so the hero scroll UX stays unchanged.
 * All other routes use `nativePushHeaderScreenOptions` (glass chrome + shared fallback).
 */
export function MainStack() {
  const reduceMotion = useReduceMotion();
  const t = useTheme();
  const push = nativePushHeaderScreenOptions(t);

  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        animation: reduceMotion ? 'fade' : 'default',
        contentStyle: { backgroundColor: t.bg },
        ...(Platform.OS === 'ios' ? { fullScreenGestureEnabled: true } : {}),
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Kin', headerShown: false }}
      />
      <Stack.Screen name="Tasks" component={TaskBoardScreen} options={{ ...push, title: 'Tasks' }} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ ...push, title: 'Calendar' }} />
      <Stack.Screen name="VisitPrep" component={VisitPrepScreen} options={{ ...push, title: 'Visit Prep' }} />
      <Stack.Screen name="Doctors" component={DoctorsScreen} options={{ ...push, title: 'Doctors' }} />
      <Stack.Screen name="Medications" component={MedicationListScreen} options={{ ...push, title: 'Medications' }} />
      <Stack.Screen
        name="MedicationDetail"
        component={MedicationDetailRoute}
        options={{ ...push, title: 'Medication' }}
      />
      <Stack.Screen name="Health" component={HealthLogScreen} options={{ ...push, title: 'Health Log' }} />
      <Stack.Screen name="Documents" component={DocumentsScreen} options={{ ...push, title: 'Documents' }} />
      <Stack.Screen name="CheckIns" component={CheckInScreen} options={{ ...push, title: 'Check-Ins' }} />
      <Stack.Screen name="Members" component={MemberListScreen} options={{ ...push, title: 'Members' }} />
      <Stack.Screen name="InviteMember" component={InviteMemberScreen} options={{ ...push, title: 'Invite a member' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ ...push, title: 'Settings' }} />
      <Stack.Screen name="Accessibility" component={AccessibilityScreen} options={{ ...push, title: 'Accessibility' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ ...push, title: 'Notifications' }} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} options={{ ...push, title: 'Appearance' }} />
      <Stack.Screen name="Language" component={LanguageScreen} options={{ ...push, title: 'Language' }} />
      <Stack.Screen name="DataPrivacy" component={DataPrivacyScreen} options={{ ...push, title: 'Data & Privacy' }} />
      <Stack.Screen name="Notes" component={NotesScreen} options={{ ...push, title: 'Notes' }} />
    </Stack.Navigator>
  );
}
