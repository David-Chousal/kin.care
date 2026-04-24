import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
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
import { SubscriptionScreen } from '../subscription/SubscriptionScreen';
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
  const { t: tx } = useTranslation();
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
        options={{ title: tx('auth.brand.name'), headerShown: false }}
      />
      <Stack.Screen
        name="Tasks"
        component={TaskBoardScreen}
        options={() => ({ ...push, title: tx('home.nav.tasks.label') })}
      />
      <Stack.Screen
        name="Calendar"
        component={CalendarScreen}
        options={() => ({ ...push, title: tx('home.nav.calendar.label') })}
      />
      <Stack.Screen
        name="VisitPrep"
        component={VisitPrepScreen}
        options={() => ({ ...push, title: tx('visitPrep.screenTitle') })}
      />
      <Stack.Screen
        name="Doctors"
        component={DoctorsScreen}
        options={() => ({ ...push, title: tx('home.nav.doctors.label') })}
      />
      <Stack.Screen
        name="Medications"
        component={MedicationListScreen}
        options={() => ({ ...push, title: tx('home.nav.medications.label') })}
      />
      <Stack.Screen
        name="MedicationDetail"
        component={MedicationDetailRoute}
        options={() => ({ ...push, title: tx('medications.detail.screenTitle') })}
      />
      <Stack.Screen
        name="Health"
        component={HealthLogScreen}
        options={() => ({ ...push, title: tx('home.nav.health.label') })}
      />
      <Stack.Screen
        name="Documents"
        component={DocumentsScreen}
        options={() => ({ ...push, title: tx('home.nav.documents.label') })}
      />
      <Stack.Screen
        name="CheckIns"
        component={CheckInScreen}
        options={() => ({ ...push, title: tx('home.nav.checkins.label') })}
      />
      <Stack.Screen
        name="Members"
        component={MemberListScreen}
        options={() => ({ ...push, title: tx('home.nav.members.label') })}
      />
      <Stack.Screen
        name="InviteMember"
        component={InviteMemberScreen}
        options={() => ({ ...push, title: tx('family.inviteMember.screenTitle') })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={() => ({ ...push, title: tx('settings.screenTitle') })}
      />
      <Stack.Screen
        name="Accessibility"
        component={AccessibilityScreen}
        options={() => ({ ...push, title: tx('settings.preferences.accessibility') })}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={() => ({ ...push, title: tx('settings.preferences.notifications') })}
      />
      <Stack.Screen
        name="Appearance"
        component={AppearanceScreen}
        options={() => ({ ...push, title: tx('settings.preferences.appearance') })}
      />
      <Stack.Screen
        name="Language"
        component={LanguageScreen}
        options={() => ({ ...push, title: tx('language.screenTitle') })}
      />
      <Stack.Screen
        name="DataPrivacy"
        component={DataPrivacyScreen}
        options={() => ({ ...push, title: tx('settings.privacy.dataPrivacy') })}
      />
      <Stack.Screen
        name="Notes"
        component={NotesScreen}
        options={() => ({ ...push, title: tx('home.nav.notes.label') })}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={() => ({ ...push, title: tx('subscription.screenTitle') })}
      />
    </Stack.Navigator>
  );
}
