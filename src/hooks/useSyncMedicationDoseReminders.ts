import { useEffect } from 'react';
import { useFamilyStore } from '../store/family';
import { useNotificationPrefs } from '../store/notifications';
import { useMedications } from '../features/medications/hooks/useMedications';
import {
  cancelAllMedicationDoseReminders,
  syncMedicationDoseReminders,
  syncLowStockRefillNudge,
} from '../lib/medicationDoseReminders';

/**
 * Keeps local dose reminders and optional low-stock refill nudges in sync with
 * the active medication list and notification preferences.
 */
export function useSyncMedicationDoseReminders() {
  const family = useFamilyStore((s) => s.family);
  const { data: medications, isSuccess } = useMedications();
  const notifPrefs = useNotificationPrefs();

  useEffect(() => {
    const ac = new AbortController();
    const { signal } = ac;

    if (!family?.id) {
      void cancelAllMedicationDoseReminders();
      return () => ac.abort();
    }
    if (!isSuccess || medications === undefined) {
      return () => ac.abort();
    }

    void syncMedicationDoseReminders(medications, { signal });
    void syncLowStockRefillNudge(medications, { signal });

    return () => ac.abort();
  }, [
    family?.id,
    isSuccess,
    medications,
    notifPrefs.masterEnabled,
    notifPrefs.medicationAlerts,
  ]);
}
