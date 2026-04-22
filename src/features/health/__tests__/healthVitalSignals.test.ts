import type { HealthLog } from '../../../types';
import {
  parseHealthLogToVitalPoint,
  logsToVitalPoints,
  trendRangeBounds,
  filterPointsInRange,
  decimateSeries,
  parseWeightToKg,
  formatHealthTrendSummaryForPrompt,
} from '../healthVitalSignals';

function log(partial: Partial<HealthLog> & Pick<HealthLog, 'id' | 'category' | 'title' | 'logged_at'>): HealthLog {
  return {
    family_id: 'f1',
    value: null,
    unit: null,
    notes: null,
    logged_by: 'u1',
    created_at: partial.logged_at,
    ...partial,
  } as HealthLog;
}

describe('parseWeightToKg', () => {
  it('parses kg from unit', () => {
    expect(parseWeightToKg('72.5', 'kg')).toBeCloseTo(72.5, 5);
  });
  it('converts lb', () => {
    expect(parseWeightToKg('154', 'lb')).toBeCloseTo(154 * 0.453592, 3);
  });
  it('returns null for empty', () => {
    expect(parseWeightToKg(null, null)).toBeNull();
  });
});

describe('parseHealthLogToVitalPoint', () => {
  it('parses vital blood pressure preset', () => {
    const p = parseHealthLogToVitalPoint(
      log({
        id: '1',
        category: 'vital',
        title: 'Blood pressure',
        value: '118/76',
        unit: 'mmHg',
        logged_at: '2026-04-01T12:00:00.000Z',
      })
    );
    expect(p?.kind).toBe('bp');
    expect(p?.systolicMmHg).toBe(118);
    expect(p?.diastolicMmHg).toBe(76);
  });

  it('parses BP in note when title matches', () => {
    const p = parseHealthLogToVitalPoint(
      log({
        id: '2',
        category: 'note',
        title: 'Blood pressure check',
        value: '130/85',
        logged_at: '2026-04-02T12:00:00.000Z',
      })
    );
    expect(p?.kind).toBe('bp');
    expect(p?.systolicMmHg).toBe(130);
  });

  it('rejects BP when value missing slash pattern', () => {
    expect(
      parseHealthLogToVitalPoint(
        log({ id: '3', category: 'vital', title: 'Blood pressure', value: '120', logged_at: '2026-01-01T00:00:00.000Z' })
      )
    ).toBeNull();
  });

  it('parses vital weight', () => {
    const p = parseHealthLogToVitalPoint(
      log({
        id: '4',
        category: 'vital',
        title: 'Weight',
        value: '70',
        unit: 'kg',
        logged_at: '2026-04-03T12:00:00.000Z',
      })
    );
    expect(p?.kind).toBe('weight');
    expect(p?.weightKg).toBeCloseTo(70, 5);
  });

  it('parses weight in note with explicit title', () => {
    const p = parseHealthLogToVitalPoint(
      log({
        id: '5',
        category: 'note',
        title: 'Body weight',
        value: '180',
        unit: 'lb',
        logged_at: '2026-04-04T12:00:00.000Z',
      })
    );
    expect(p?.kind).toBe('weight');
    expect(p?.weightKg).toBeCloseTo(180 * 0.453592, 2);
  });
});

describe('trendRangeBounds', () => {
  it('7d spans 7 local calendar days inclusive', () => {
    const now = new Date(2026, 3, 21, 15, 30, 0);
    const { start, end } = trendRangeBounds('7d', now);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(3);
    expect(end.getDate()).toBe(21);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(3);
    expect(start.getDate()).toBe(15);
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
  });
});

describe('filterPointsInRange', () => {
  it('filters by loggedAt', () => {
    const pts = [
      { logId: 'a', loggedAt: '2026-04-10T12:00:00.000Z', kind: 'bp' as const, systolicMmHg: 120, diastolicMmHg: 80, raw: { title: '', value: '', unit: null } },
    ];
    const start = new Date('2026-04-10T00:00:00.000Z');
    const end = new Date('2026-04-10T23:59:59.999Z');
    expect(filterPointsInRange(pts, start, end).length).toBe(1);
    expect(filterPointsInRange(pts, new Date('2026-04-11T0:0:0Z'), new Date('2026-04-12T0:0:0Z')).length).toBe(0);
  });
});

describe('decimateSeries', () => {
  it('returns all when under cap', () => {
    expect(decimateSeries([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });
  it('reduces length', () => {
    const arr = Array.from({ length: 100 }, (_, i) => i);
    expect(decimateSeries(arr, 12).length).toBeLessThanOrEqual(12);
  });
});

describe('logsToVitalPoints', () => {
  it('sorts ascending by time', () => {
    const logs = [
      log({ id: 'b', category: 'vital', title: 'Weight', value: '70', unit: 'kg', logged_at: '2026-04-02T00:00:00.000Z' }),
      log({ id: 'a', category: 'vital', title: 'Weight', value: '69', unit: 'kg', logged_at: '2026-04-01T00:00:00.000Z' }),
    ];
    const pts = logsToVitalPoints(logs);
    expect(pts.map((p) => p.logId)).toEqual(['a', 'b']);
  });
});

describe('formatHealthTrendSummaryForPrompt', () => {
  it('includes BP and weight trend lines when enough points', () => {
    const logs = [
      log({ id: '1', category: 'vital', title: 'Blood pressure', value: '120/80', logged_at: '2026-04-01T00:00:00.000Z' }),
      log({ id: '2', category: 'vital', title: 'Blood pressure', value: '118/78', logged_at: '2026-04-02T00:00:00.000Z' }),
      log({ id: '3', category: 'vital', title: 'Weight', value: '70', unit: 'kg', logged_at: '2026-04-01T00:00:00.000Z' }),
      log({ id: '4', category: 'vital', title: 'Weight', value: '69.5', unit: 'kg', logged_at: '2026-04-02T00:00:00.000Z' }),
    ];
    const s = formatHealthTrendSummaryForPrompt(logs);
    expect(s).toContain('Blood pressure:');
    expect(s).toContain('Weight:');
  });
});
