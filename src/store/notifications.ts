import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationPrefsState {
  masterEnabled: boolean;
  taskReminders: boolean;
  taskAssigned: boolean;
  medicationAlerts: boolean;
  checkinReminders: boolean;
  eventReminders: boolean;
  /**
   * Single global ask policy for OS notification permission.
   * Once true, we do not auto-trigger the OS prompt again from feature flows.
   */
  permissionAskedOnce: boolean;
  /** Last observed OS permission status (best-effort; used for UX decisions). */
  lastPermissionStatus?: string;
  setMasterEnabled: (v: boolean) => void;
  setTaskReminders: (v: boolean) => void;
  setTaskAssigned: (v: boolean) => void;
  setMedicationAlerts: (v: boolean) => void;
  setCheckinReminders: (v: boolean) => void;
  setEventReminders: (v: boolean) => void;
  /** Called after the OS permission dialog is shown — marks asked once and records resulting status. */
  markPermissionAsked: (status: string) => void;
  /** Called to sync the OS permission status without marking the dialog as having been shown. */
  syncPermissionStatus: (status: string) => void;
}

export const useNotificationPrefs = create<NotificationPrefsState>()(
  persist(
    (set) => ({
      masterEnabled: true,
      taskReminders: true,
      taskAssigned: true,
      medicationAlerts: true,
      checkinReminders: true,
      eventReminders: true,
      permissionAskedOnce: false,
      lastPermissionStatus: undefined,
      setMasterEnabled: (masterEnabled) => set({ masterEnabled }),
      setTaskReminders: (taskReminders) => set({ taskReminders }),
      setTaskAssigned: (taskAssigned) => set({ taskAssigned }),
      setMedicationAlerts: (medicationAlerts) => set({ medicationAlerts }),
      setCheckinReminders: (checkinReminders) => set({ checkinReminders }),
      setEventReminders: (eventReminders) => set({ eventReminders }),
      markPermissionAsked: (status) => set({ permissionAskedOnce: true, lastPermissionStatus: status }),
      syncPermissionStatus: (status) => set({ lastPermissionStatus: status }),
    }),
    {
      name: 'kin-notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
