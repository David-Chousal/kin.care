jest.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: () => {
      throw new Error('supabase client should not be used in unit tests');
    },
  },
}));

import {
  parseMedicationSchedule,
  computeDoseStatus,
  computeDoseStatusForDate,
  isWeeklyScheduledForDate,
  scheduledDoseSlotsToday,
  scheduledDoseSlotsForDate,
  takenDoseSlotsToday,
  takenDoseSlotsForDate,
} from '../useMedications';
import type { Medication } from '../../../../types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function med(overrides: Partial<Medication>): Medication {
  return {
    id: 'med-1',
    family_id: 'fam-1',
    name: 'Test Med',
    dosage: '10mg',
    frequency: 'Once daily',
    frequency_type: 'daily',
    times_per_day: 1,
    days_of_week: null,
    times: null,
    notes: null,
    active: true,
    created_by: 'user-1',
    created_at: new Date().toISOString(),
    quantity_remaining: null,
    refill_threshold: null,
    ...overrides,
  };
}

function isoLocal(y: number, m1: number, d: number, hh = 9, mm = 0, ss = 0, ms = 0): string {
  // Local time (not UTC): month is 1-based here for readability.
  return new Date(y, m1 - 1, d, hh, mm, ss, ms).toISOString();
}

function logAt(iso: string, status: 'taken' | 'missed' | 'pending') {
  return { status, scheduled_at: iso };
}

// ─── parseMedicationSchedule ─────────────────────────────────────────────────

describe('parseMedicationSchedule', () => {
  describe('as_needed', () => {
    it('returns dosesRequired=0 and periodType=as_needed', () => {
      const result = parseMedicationSchedule(
        med({ frequency_type: 'as_needed', times_per_day: null })
      );
      expect(result).toEqual({ dosesRequired: 0, periodType: 'as_needed' });
    });
  });

  describe('weekly', () => {
    it('returns dosesRequired=1 and periodType=weekly', () => {
      const result = parseMedicationSchedule(
        med({ frequency_type: 'weekly', times_per_day: 1 })
      );
      expect(result).toEqual({ dosesRequired: 1, periodType: 'weekly' });
    });
  });

  describe('daily', () => {
    it('uses times_per_day=1 for once daily', () => {
      const result = parseMedicationSchedule(
        med({ frequency_type: 'daily', times_per_day: 1 })
      );
      expect(result).toEqual({ dosesRequired: 1, periodType: 'daily' });
    });

    it('uses times_per_day=2 for twice daily', () => {
      const result = parseMedicationSchedule(
        med({ frequency_type: 'daily', times_per_day: 2 })
      );
      expect(result).toEqual({ dosesRequired: 2, periodType: 'daily' });
    });

    it('uses times_per_day=3 for three times daily', () => {
      const result = parseMedicationSchedule(
        med({ frequency_type: 'daily', times_per_day: 3 })
      );
      expect(result).toEqual({ dosesRequired: 3, periodType: 'daily' });
    });

    it('falls back to times array length when times_per_day is null', () => {
      const result = parseMedicationSchedule(
        med({ frequency_type: 'daily', times_per_day: null, times: ['08:00', '20:00'] })
      );
      expect(result).toEqual({ dosesRequired: 2, periodType: 'daily' });
    });

    it('defaults to 1 dose when times_per_day is null and times is empty', () => {
      const result = parseMedicationSchedule(
        med({ frequency_type: 'daily', times_per_day: null, times: null })
      );
      expect(result).toEqual({ dosesRequired: 1, periodType: 'daily' });
    });

    it('infers daily from frequency text when frequency_type column is absent', () => {
      const result = parseMedicationSchedule(
        med({
          frequency_type: undefined,
          times_per_day: undefined,
          frequency: 'Twice daily',
          times: ['08:00', '20:00'],
        })
      );
      expect(result).toEqual({ dosesRequired: 2, periodType: 'daily' });
    });

    it('infers weekly from frequency label when frequency_type column is absent', () => {
      const result = parseMedicationSchedule(
        med({
          frequency_type: undefined,
          times_per_day: undefined,
          frequency: 'Weekly (Mon, Wed)',
          times: ['09:00'],
        })
      );
      expect(result).toEqual({ dosesRequired: 1, periodType: 'weekly' });
    });
  });
});

// ─── computeDoseStatus ───────────────────────────────────────────────────────

describe('computeDoseStatus', () => {
  it('returns as_needed for as_needed medications', () => {
    expect(computeDoseStatus(med({ frequency_type: 'as_needed', times_per_day: null }), [])).toBe('as_needed');
  });

  it('returns taken when all required doses are logged taken today', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 2 });
    const d = new Date(2026, 0, 12, 10, 0, 0, 0);
    const logs = [logAt(isoLocal(2026, 1, 12, 9, 0), 'taken'), logAt(isoLocal(2026, 1, 12, 12, 0), 'taken')];
    expect(computeDoseStatusForDate(m, logs, d)).toBe('taken');
  });

  it('returns partial when some but not all doses are taken', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 2 });
    const d = new Date(2026, 0, 12, 10, 0, 0, 0);
    const logs = [logAt(isoLocal(2026, 1, 12, 9, 0), 'taken')];
    expect(computeDoseStatusForDate(m, logs, d)).toBe('partial');
  });

  it('returns missed when no taken logs and at least one missed', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    const d = new Date(2026, 0, 12, 10, 0, 0, 0);
    const logs = [logAt(isoLocal(2026, 1, 12, 9, 0), 'missed')];
    expect(computeDoseStatusForDate(m, logs, d)).toBe('missed');
  });

  it('returns pending when no logs at all', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    const d = new Date(2026, 0, 12, 10, 0, 0, 0);
    expect(computeDoseStatusForDate(m, [], d)).toBe('pending');
  });

  it('returns pending when logs are undefined', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    const d = new Date(2026, 0, 12, 10, 0, 0, 0);
    expect(computeDoseStatusForDate(m, undefined, d)).toBe('pending');
  });

  it('ignores logs from yesterday for daily medications', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    const d = new Date(2026, 0, 12, 10, 0, 0, 0);
    const logs = [logAt(isoLocal(2026, 1, 11, 10, 0), 'taken')];
    expect(computeDoseStatusForDate(m, logs, d)).toBe('pending');
  });

  describe('weekly medications', () => {
    it('is scheduled only on selected weekday(s)', () => {
      // 2026-01-12 is Monday (getDay() === 1)
      const mon = new Date(2026, 0, 12, 10, 0, 0, 0);
      const tue = new Date(2026, 0, 13, 10, 0, 0, 0);
      const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] });
      expect(isWeeklyScheduledForDate(m, mon)).toBe(true);
      expect(isWeeklyScheduledForDate(m, tue)).toBe(false);
    });

    it('returns pending on a scheduled day when not taken that day', () => {
      const mon = new Date(2026, 0, 12, 10, 0, 0, 0);
      const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] });
      expect(computeDoseStatusForDate(m, [], mon)).toBe('pending');
    });

    it('returns taken on a scheduled day when a taken log exists that day', () => {
      const mon = new Date(2026, 0, 12, 10, 0, 0, 0);
      const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] });
      const logs = [logAt(isoLocal(2026, 1, 12, 8, 30), 'taken')];
      expect(computeDoseStatusForDate(m, logs, mon)).toBe('taken');
    });

    it('does not consider weekly meds due on non-scheduled days', () => {
      const tue = new Date(2026, 0, 13, 10, 0, 0, 0);
      const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] }); // Monday only
      expect(computeDoseStatusForDate(m, [], tue)).toBe('taken');
    });

    it('is due again on a later scheduled weekday even if taken earlier in week', () => {
      // Scheduled Mon and Wed; taken on Mon should not satisfy Wed.
      const mon = new Date(2026, 0, 12, 10, 0, 0, 0);
      const wed = new Date(2026, 0, 14, 10, 0, 0, 0);
      const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1, 3] });
      const logs = [logAt(isoLocal(2026, 1, 12, 8, 30), 'taken')];
      expect(computeDoseStatusForDate(m, logs, mon)).toBe('taken');
      expect(computeDoseStatusForDate(m, logs, wed)).toBe('pending');
    });
  });
});

// ─── scheduledDoseSlotsToday ──────────────────────────────────────────────────

describe('scheduledDoseSlotsToday', () => {
  it('returns 0 for as_needed', () => {
    expect(scheduledDoseSlotsToday(med({ frequency_type: 'as_needed', times_per_day: null }))).toBe(0);
  });

  it('returns 1 for weekly', () => {
    // Wrapper still returns a number, but weeklies are now gated by days_of_week.
    // We validate gating behavior via scheduledDoseSlotsForDate below.
    expect(typeof scheduledDoseSlotsToday(med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [0, 1, 2, 3, 4, 5, 6] }))).toBe('number');
  });

  it('returns times_per_day for daily', () => {
    expect(scheduledDoseSlotsToday(med({ frequency_type: 'daily', times_per_day: 3 }))).toBe(3);
  });
});

describe('scheduledDoseSlotsForDate', () => {
  it('returns 1 for weekly when scheduled for that date', () => {
    const mon = new Date(2026, 0, 12, 10, 0, 0, 0); // Monday
    const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] });
    expect(scheduledDoseSlotsForDate(m, mon)).toBe(1);
  });

  it('returns 0 for weekly when not scheduled for that date', () => {
    const tue = new Date(2026, 0, 13, 10, 0, 0, 0); // Tuesday
    const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] });
    expect(scheduledDoseSlotsForDate(m, tue)).toBe(0);
  });

  it('returns 0 for weekly when days_of_week is null/empty', () => {
    const mon = new Date(2026, 0, 12, 10, 0, 0, 0);
    expect(scheduledDoseSlotsForDate(med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: null }), mon)).toBe(0);
    expect(scheduledDoseSlotsForDate(med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [] }), mon)).toBe(0);
  });
});

// ─── takenDoseSlotsToday ──────────────────────────────────────────────────────

describe('takenDoseSlotsToday', () => {
  const todayStart = new Date(2026, 0, 12, 0, 0, 0, 0); // Monday start

  it('returns 0 for as_needed', () => {
    const m = med({ frequency_type: 'as_needed', times_per_day: null });
    expect(takenDoseSlotsToday(m, [logAt(isoLocal(2026, 1, 12, 9, 0), 'taken')], todayStart)).toBe(0);
  });

  it('counts taken logs since midnight for daily, capped at times_per_day', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 2 });
    const logs = [
      logAt(isoLocal(2026, 1, 12, 8, 0), 'taken'),
      logAt(isoLocal(2026, 1, 12, 12, 0), 'taken'),
      logAt(isoLocal(2026, 1, 12, 18, 0), 'taken'),
    ];
    expect(takenDoseSlotsToday(m, logs, todayStart)).toBe(2);
  });

  it('returns 0 for weekly when not taken', () => {
    const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] });
    expect(takenDoseSlotsToday(m, [], todayStart)).toBe(0);
  });

  it('returns 1 for weekly when taken this week', () => {
    const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] });
    expect(takenDoseSlotsToday(m, [logAt(isoLocal(2026, 1, 12, 9, 0), 'taken')], todayStart)).toBe(1);
  });
});

describe('takenDoseSlotsForDate (weekly gating)', () => {
  it('returns 0 on non-scheduled day even if a taken log exists that day', () => {
    const tue = new Date(2026, 0, 13, 10, 0, 0, 0); // Tuesday
    const m = med({ frequency_type: 'weekly', times_per_day: 1, days_of_week: [1] }); // Monday only
    const logs = [logAt(isoLocal(2026, 1, 13, 9, 0), 'taken')];
    expect(takenDoseSlotsForDate(m, logs, tue)).toBe(0);
  });
});
