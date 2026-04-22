import {
  parseMedicationSchedule,
  computeDoseStatus,
  scheduledDoseSlotsToday,
  takenDoseSlotsToday,
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

function todayLog(status: 'taken' | 'missed' | 'pending') {
  return { status, scheduled_at: new Date().toISOString() };
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
    const logs = [todayLog('taken'), todayLog('taken')];
    expect(computeDoseStatus(m, logs)).toBe('taken');
  });

  it('returns partial when some but not all doses are taken', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 2 });
    const logs = [todayLog('taken')];
    expect(computeDoseStatus(m, logs)).toBe('partial');
  });

  it('returns missed when no taken logs and at least one missed', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    const logs = [todayLog('missed')];
    expect(computeDoseStatus(m, logs)).toBe('missed');
  });

  it('returns pending when no logs at all', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    expect(computeDoseStatus(m, [])).toBe('pending');
  });

  it('returns pending when logs are undefined', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    expect(computeDoseStatus(m, undefined)).toBe('pending');
  });

  it('ignores logs from yesterday for daily medications', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 1 });
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(10, 0, 0, 0);
    const logs = [{ status: 'taken', scheduled_at: yesterday.toISOString() }];
    expect(computeDoseStatus(m, logs)).toBe('pending');
  });

  describe('weekly medications', () => {
    it('returns taken when 1 taken log exists in the past 7 days', () => {
      const m = med({ frequency_type: 'weekly', times_per_day: 1 });
      const logs = [todayLog('taken')];
      expect(computeDoseStatus(m, logs)).toBe('taken');
    });

    it('returns pending when no logs in the past 7 days', () => {
      const m = med({ frequency_type: 'weekly', times_per_day: 1 });
      expect(computeDoseStatus(m, [])).toBe('pending');
    });
  });
});

// ─── scheduledDoseSlotsToday ──────────────────────────────────────────────────

describe('scheduledDoseSlotsToday', () => {
  it('returns 0 for as_needed', () => {
    expect(scheduledDoseSlotsToday(med({ frequency_type: 'as_needed', times_per_day: null }))).toBe(0);
  });

  it('returns 1 for weekly', () => {
    expect(scheduledDoseSlotsToday(med({ frequency_type: 'weekly', times_per_day: 1 }))).toBe(1);
  });

  it('returns times_per_day for daily', () => {
    expect(scheduledDoseSlotsToday(med({ frequency_type: 'daily', times_per_day: 3 }))).toBe(3);
  });
});

// ─── takenDoseSlotsToday ──────────────────────────────────────────────────────

describe('takenDoseSlotsToday', () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  it('returns 0 for as_needed', () => {
    const m = med({ frequency_type: 'as_needed', times_per_day: null });
    expect(takenDoseSlotsToday(m, [todayLog('taken')], todayStart)).toBe(0);
  });

  it('counts taken logs since midnight for daily, capped at times_per_day', () => {
    const m = med({ frequency_type: 'daily', times_per_day: 2 });
    const logs = [todayLog('taken'), todayLog('taken'), todayLog('taken')];
    expect(takenDoseSlotsToday(m, logs, todayStart)).toBe(2);
  });

  it('returns 0 for weekly when not taken', () => {
    const m = med({ frequency_type: 'weekly', times_per_day: 1 });
    expect(takenDoseSlotsToday(m, [], todayStart)).toBe(0);
  });

  it('returns 1 for weekly when taken this week', () => {
    const m = med({ frequency_type: 'weekly', times_per_day: 1 });
    expect(takenDoseSlotsToday(m, [todayLog('taken')], todayStart)).toBe(1);
  });
});
