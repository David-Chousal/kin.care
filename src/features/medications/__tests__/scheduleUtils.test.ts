import {
  pad2,
  clampMinutes,
  minutesToHHMM,
  parseHHMMToMinutes,
  sortUniqueHHMMFromMinutes,
  adjustHour,
  adjustMinute,
  inferFrequencyTypeFromLegacyFrequency,
  dailyFrequencyLabel,
  weeklyFrequencyLabel,
  sortedUniqueDays,
  minutesFromTimeStrings,
  medicationStructuredScheduleFields,
  appWeekdayToExpoWeekday,
} from '../scheduleUtils';

describe('pad2', () => {
  it('pads single digits', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(9)).toBe('09');
  });
  it('leaves two-digit as string', () => {
    expect(pad2(10)).toBe('10');
  });
});

describe('clampMinutes', () => {
  it('clamps low and high', () => {
    expect(clampMinutes(-10)).toBe(0);
    expect(clampMinutes(2000)).toBe(1439);
  });
  it('rounds', () => {
    expect(clampMinutes(60.4)).toBe(60);
  });
});

describe('minutesToHHMM / parseHHMMToMinutes', () => {
  it('round-trips midnight and end of day', () => {
    expect(minutesToHHMM(0)).toBe('00:00');
    expect(parseHHMMToMinutes('00:00')).toBe(0);
    expect(minutesToHHMM(1439)).toBe('23:59');
    expect(parseHHMMToMinutes('23:59')).toBe(1439);
  });
  it('parses single-digit hour', () => {
    expect(parseHHMMToMinutes('9:30')).toBe(9 * 60 + 30);
  });
  it('returns null for invalid', () => {
    expect(parseHHMMToMinutes('24:00')).toBeNull();
    expect(parseHHMMToMinutes('12:60')).toBeNull();
    expect(parseHHMMToMinutes('bad')).toBeNull();
  });
});

describe('sortUniqueHHMMFromMinutes', () => {
  it('dedupes and sorts', () => {
    expect(sortUniqueHHMMFromMinutes([20 * 60, 8 * 60, 8 * 60])).toEqual(['08:00', '20:00']);
  });
});

describe('adjustHour', () => {
  it('steps hour down within same day', () => {
    expect(adjustHour(60, -1)).toBe(0);
  });
  it('wraps backward from midnight', () => {
    expect(adjustHour(30, -1)).toBe(23 * 60 + 30);
  });
  it('wraps forward', () => {
    expect(adjustHour(23 * 60 + 30, 1)).toBe(30);
  });
});

describe('adjustMinute', () => {
  it('steps by 5 by default', () => {
    expect(adjustMinute(60, 1)).toBe(65);
    expect(adjustMinute(65, -1)).toBe(60);
  });
});

describe('inferFrequencyTypeFromLegacyFrequency', () => {
  it('detects as_needed', () => {
    expect(inferFrequencyTypeFromLegacyFrequency('As needed')).toBe('as_needed');
    expect(inferFrequencyTypeFromLegacyFrequency('prn')).toBe('as_needed');
  });
  it('detects weekly', () => {
    expect(inferFrequencyTypeFromLegacyFrequency('Weekly')).toBe('weekly');
    expect(inferFrequencyTypeFromLegacyFrequency('Weekly (Mon, Wed)')).toBe('weekly');
  });
  it('defaults to daily', () => {
    expect(inferFrequencyTypeFromLegacyFrequency('Once daily')).toBe('daily');
  });
});

describe('dailyFrequencyLabel', () => {
  it('maps counts', () => {
    expect(dailyFrequencyLabel(1)).toBe('Once daily');
    expect(dailyFrequencyLabel(2)).toBe('Twice daily');
    expect(dailyFrequencyLabel(3)).toBe('Three times daily');
    expect(dailyFrequencyLabel(4)).toBe('4× daily');
  });
});

describe('weeklyFrequencyLabel', () => {
  it('handles empty', () => {
    expect(weeklyFrequencyLabel([])).toBe('Weekly');
  });
  it('lists short names', () => {
    expect(weeklyFrequencyLabel([1, 3])).toBe('Weekly (Mon, Wed)');
  });
});

describe('sortedUniqueDays', () => {
  it('filters and sorts', () => {
    expect(sortedUniqueDays([3, 1, 1, 99])).toEqual([1, 3]);
  });
});

describe('minutesFromTimeStrings', () => {
  it('uses fallback when empty', () => {
    expect(minutesFromTimeStrings(null)).toEqual([9 * 60]);
  });
  it('parses valid list', () => {
    expect(minutesFromTimeStrings(['08:00', '20:00'])).toEqual([8 * 60, 20 * 60]);
  });
});

describe('appWeekdayToExpoWeekday', () => {
  it('maps Sunday through Saturday to Expo 1–7', () => {
    expect(appWeekdayToExpoWeekday(0)).toBe(1);
    expect(appWeekdayToExpoWeekday(6)).toBe(7);
  });
});

describe('medicationStructuredScheduleFields', () => {
  it('maps as_needed', () => {
    expect(medicationStructuredScheduleFields('as_needed', [480], [])).toEqual({
      frequency_type: 'as_needed',
      times: null,
      times_per_day: null,
      days_of_week: null,
    });
  });
  it('maps daily with sorted times', () => {
    expect(medicationStructuredScheduleFields('daily', [20 * 60, 8 * 60], [])).toEqual({
      frequency_type: 'daily',
      times: ['08:00', '20:00'],
      times_per_day: 2,
      days_of_week: null,
    });
  });
  it('maps weekly with days', () => {
    expect(medicationStructuredScheduleFields('weekly', [9 * 60], [3, 1])).toEqual({
      frequency_type: 'weekly',
      times: ['09:00'],
      times_per_day: 1,
      days_of_week: [1, 3],
    });
  });
});
