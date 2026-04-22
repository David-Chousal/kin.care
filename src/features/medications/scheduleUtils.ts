import type { MedicationFrequencyType } from '../../types';

export const MINUTES_PER_DAY = 1440;
export const MAX_DOSE_TIMES = 4;

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Clamp to same calendar day, 00:00–23:59. */
export function clampMinutes(m: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(m)));
}

export function minutesToHHMM(minutes: number): string {
  const m = clampMinutes(minutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${pad2(h)}:${pad2(min)}`;
}

/** Strict HH:MM 24h; returns null if invalid. */
export function parseHHMMToMinutes(s: string): number | null {
  const t = s.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const min = parseInt(match[2], 10);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Deduplicate, sort ascending, emit HH:MM strings. */
export function sortUniqueHHMMFromMinutes(minuteRows: number[]): string[] {
  const unique = [...new Set(minuteRows.map(clampMinutes))].sort((a, b) => a - b);
  return unique.map(minutesToHHMM);
}

export function adjustHour(minutes: number, delta: number): number {
  const m = clampMinutes(minutes);
  const h = Math.floor(m / 60);
  const min = m % 60;
  const newH = (h + delta + 24) % 24;
  return newH * 60 + min;
}

/** Step minutes within the hour; wraps hour when crossing 0/59 boundary. */
export function adjustMinute(minutes: number, delta: number, step = 5): number {
  const m = clampMinutes(minutes);
  const total = m + delta * step;
  return clampMinutes(total);
}

export function inferFrequencyTypeFromLegacyFrequency(frequency: string): MedicationFrequencyType {
  const f = frequency.trim().toLowerCase();
  if (f.includes('as needed') || f === 'prn') return 'as_needed';
  if (f === 'weekly' || f.startsWith('weekly')) return 'weekly';
  return 'daily';
}

export function dailyFrequencyLabel(timesCount: number): string {
  if (timesCount <= 1) return 'Once daily';
  if (timesCount === 2) return 'Twice daily';
  if (timesCount === 3) return 'Three times daily';
  return `${timesCount}× daily`;
}

export function weeklyFrequencyLabel(days: number[]): string {
  const sorted = [...new Set(days)]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 'Weekly';
  if (sorted.length === 7) return 'Weekly (every day)';
  return `Weekly (${sorted.map((d) => SHORT_DAYS[d]).join(', ')})`;
}

export function sortedUniqueDays(days: number[]): number[] {
  return [...new Set(days)]
    .filter((d) => d >= 0 && d <= 6)
    .sort((a, b) => a - b);
}

/** Parse medication times strings into minute values; skip invalid entries. */
export function minutesFromTimeStrings(times: string[] | null | undefined, fallbackMinutes = 9 * 60): number[] {
  if (!times?.length) return [fallbackMinutes];
  const parsed = times.map((s) => parseHHMMToMinutes(s)).filter((m): m is number => m !== null);
  return parsed.length ? parsed : [fallbackMinutes];
}
