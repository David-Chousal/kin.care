import { useEffect, useMemo, useRef } from 'react';
import { View, Platform, StyleSheet, useColorScheme } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useThemeStore } from '../../store/theme';
import { hapticSelection } from '../../lib/haptics';
import { clampMinutes } from './scheduleUtils';

export interface DoseTimeWheelPickerProps {
  /** Minutes since local midnight (0–1439). */
  minutes: number;
  /** 0-based dose row index (accessibility). */
  doseIndex: number;
  accentColor: string;
  onChange: (hour: number, minute: number) => void;
}

/** Stable calendar anchor so only wall-clock fields matter (avoids DST edge cases). */
const ANCHOR_YEAR = 2000;
const ANCHOR_MONTH = 0;
const ANCHOR_DAY = 1;

function dateFromMinutes(totalMinutes: number): Date {
  const t = clampMinutes(totalMinutes);
  const h = Math.floor(t / 60);
  const m = t % 60;
  return new Date(ANCHOR_YEAR, ANCHOR_MONTH, ANCHOR_DAY, h, m, 0, 0);
}

/**
 * iOS-style vertical time wheels via native `UIDatePicker` / Android `DatePicker` spinner mode.
 * Uses `display="spinner"` on both platforms (Expo Go: same module as calendar flows).
 *
 * **Nested scroll:** Parent `AddMedicationSheet` enables
 * `ScrollView` `nestedScrollEnabled` so the wheel can scroll inside the sheet on Android.
 * Fixed height here (`wrap`) avoids unbounded layout fights with the parent `ScrollView`.
 *
 * **Theme:** iOS uses `themeVariant` + `accentColor` from app theme; Android omits those props.
 */
export function DoseTimeWheelPicker({
  minutes,
  doseIndex,
  accentColor,
  onChange,
}: DoseTimeWheelPickerProps) {
  const preference = useThemeStore((s) => s.colorScheme);
  const systemScheme = useColorScheme();
  const resolved = preference === 'system' ? (systemScheme ?? 'light') : preference;
  const themeVariant = resolved === 'dark' ? 'dark' : 'light';

  const value = useMemo(() => dateFromMinutes(minutes), [minutes]);
  const lastHm = useRef({ h: value.getHours(), m: value.getMinutes() });

  useEffect(() => {
    const d = dateFromMinutes(minutes);
    lastHm.current = { h: d.getHours(), m: d.getMinutes() };
  }, [minutes]);

  function handleChange(_event: unknown, selected?: Date) {
    if (!selected) return;
    const h = selected.getHours();
    const m = selected.getMinutes();
    if (lastHm.current.h !== h || lastHm.current.m !== m) {
      lastHm.current = { h, m };
      hapticSelection();
    }
    onChange(h, m);
  }

  return (
    <View style={styles.wrap} accessibilityLabel={`Dose ${doseIndex + 1} time`}>
      <DateTimePicker
        value={value}
        mode="time"
        display="spinner"
        {...(Platform.OS === 'ios' ? { minuteInterval: 1 as const } : {})}
        onChange={handleChange}
        {...(Platform.OS === 'ios'
          ? { themeVariant: themeVariant as 'light' | 'dark', accentColor }
          : {})}
        style={styles.picker}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /** iOS UIDatePicker wheel ~178–216pt; fixed height helps nested ScrollView layout. */
  wrap: {
    height: Platform.OS === 'ios' ? 216 : 200,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  picker: {
    flex: 1,
    width: '100%',
  },
});
