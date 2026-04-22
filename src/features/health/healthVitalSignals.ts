import type { HealthLog } from '../../types';

export type VitalKind = 'bp' | 'weight';

/** One chartable sample derived from a single health log row. */
export interface NormalizedVitalPoint {
  logId: string;
  loggedAt: string;
  kind: VitalKind;
  systolicMmHg?: number;
  diastolicMmHg?: number;
  weightKg?: number;
  raw: { title: string; value: string | null; unit: string | null };
}

export type HealthTrendRange = '7d' | '30d' | '365d' | 'all';

/** Inclusive local-calendar window: from start of first day through end of last day (today). */
export function trendRangeBounds(
  range: HealthTrendRange,
  now: Date = new Date()
): { start: Date; end: Date } {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  if (range === '7d') {
    start.setDate(start.getDate() - 6);
  } else if (range === '30d') {
    start.setDate(start.getDate() - 29);
  } else if (range === '365d') {
    start.setDate(start.getDate() - 364);
  } else {
    start.setTime(0);
    start.setFullYear(1970, 0, 1);
  }
  return { start, end };
}

function normTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Blood pressure: title hints or value `sys/dia`. */
const BP_TITLE_RE = /\b(blood\s*pressure|b\.?\s*p\.?)\b/i;
const BP_VALUE_RE = /(\d{2,3})\s*[/\u2212\-]\s*(\d{2,3})/;

/** Weight: title hints + numeric value (unit on value or column). */
const WEIGHT_TITLE_RE = /\b(weight|body\s*weight|wt\.?)\b/i;

function parseBpNumbers(value: string | null): { sys: number; dia: number } | null {
  if (!value) return null;
  const m = value.trim().match(BP_VALUE_RE);
  if (!m) return null;
  const sys = Number(m[1]);
  const dia = Number(m[2]);
  if (!Number.isFinite(sys) || !Number.isFinite(dia)) return null;
  if (sys < 40 || sys > 300 || dia < 20 || dia > 200) return null;
  if (sys <= dia) return null;
  return { sys, dia };
}

function parseNumberToken(s: string): number | null {
  const t = s.replace(/,/g, '.').trim();
  const m = t.match(/-?\d+\.?\d*/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

/** Returns mass in kg, or null. */
export function parseWeightToKg(value: string | null, unit: string | null): number | null {
  if (!value) return null;
  const n = parseNumberToken(value);
  if (n === null || n <= 0) return null;
  const u = `${unit ?? ''} ${value}`.toLowerCase();
  if (/\b(st|stone|stones)\b/.test(u)) {
    const kg = n * 6.35029;
    return kg > 0 && kg < 500 ? kg : null;
  }
  if (/\b(lb|lbs|pound|pounds|#)\b/.test(u) || /\b(lb|lbs|pound|pounds)\b/.test(value.toLowerCase())) {
    const kg = n * 0.453592;
    return kg > 0 && kg < 500 ? kg : null;
  }
  if (/\b(kg|kgs|kilogram|kilograms)\b/.test(u) || /\bkg\b/.test(value.toLowerCase())) {
    return n > 0 && n < 500 ? n : null;
  }
  if (unit && /\b(kg|kgs)\b/i.test(unit)) return n > 0 && n < 500 ? n : null;
  if (unit && /\b(lb|lbs)\b/i.test(unit)) {
    const kg = n * 0.453592;
    return kg > 0 && kg < 500 ? kg : null;
  }
  if (n >= 15 && n <= 300) return n;
  if (n > 300 && n < 700) {
    const kg = n * 0.453592;
    return kg < 500 ? kg : null;
  }
  return null;
}

/**
 * If this row represents a single BP or weight reading, return one point; otherwise null.
 * BP: `sys/dia` in value and (vital category or BP-related title).
 * Weight: numeric mass in value/unit and (vital + weight title, or note/symptom with explicit weight title).
 */
export function parseHealthLogToVitalPoint(log: HealthLog): NormalizedVitalPoint | null {
  const title = log.title ?? '';
  const value = log.value;
  const unit = log.unit;
  const titleN = normTitle(title);

  const bpNums = parseBpNumbers(value);
  const bpTitle = BP_TITLE_RE.test(titleN) || titleN === 'bp';
  if (bpNums && (log.category === 'vital' || bpTitle)) {
    return {
      logId: log.id,
      loggedAt: log.logged_at,
      kind: 'bp',
      systolicMmHg: bpNums.sys,
      diastolicMmHg: bpNums.dia,
      raw: { title, value, unit },
    };
  }

  const weightTitle = WEIGHT_TITLE_RE.test(titleN);
  const kg = parseWeightToKg(value, unit);
  const weightAllowed =
    (log.category === 'vital' && weightTitle) ||
    (weightTitle && (log.category === 'note' || log.category === 'symptom') && kg !== null);
  if (kg !== null && weightAllowed) {
    return {
      logId: log.id,
      loggedAt: log.logged_at,
      kind: 'weight',
      weightKg: kg,
      raw: { title, value, unit },
    };
  }

  return null;
}

export function logsToVitalPoints(logs: HealthLog[]): NormalizedVitalPoint[] {
  const out: NormalizedVitalPoint[] = [];
  for (const log of logs) {
    const p = parseHealthLogToVitalPoint(log);
    if (p) out.push(p);
  }
  return out.sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());
}

export function filterPointsInRange(
  points: NormalizedVitalPoint[],
  start: Date,
  end: Date
): NormalizedVitalPoint[] {
  const t0 = start.getTime();
  const t1 = end.getTime();
  return points.filter((p) => {
    const t = new Date(p.loggedAt).getTime();
    return t >= t0 && t <= t1;
  });
}

/** Evenly spaced samples including approximate endpoints; drops duplicate indices. */
export function decimateSeries<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return items;
  if (maxPoints < 2) return [items[items.length - 1]!];
  const out: T[] = [];
  const n = items.length;
  const step = (n - 1) / (maxPoints - 1);
  let lastIdx = -1;
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.min(n - 1, Math.round(i * step));
    if (idx !== lastIdx) {
      out.push(items[idx]!);
      lastIdx = idx;
    }
  }
  return out;
}

export function trendSummaryA11yLabel(
  kind: 'bp' | 'weight',
  points: NormalizedVitalPoint[],
  rangeLabel: string
): string {
  if (points.length === 0) {
    return kind === 'bp'
      ? `No blood pressure readings in ${rangeLabel}.`
      : `No weight readings in ${rangeLabel}.`;
  }
  const first = new Date(points[0]!.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const last = new Date(points[points.length - 1]!.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (kind === 'bp') {
    const lastP = points[points.length - 1]!;
    const sys = lastP.systolicMmHg;
    const dia = lastP.diastolicMmHg;
    return `Blood pressure trend, ${rangeLabel}, ${points.length} readings from ${first} to ${last}. Latest ${sys} over ${dia} millimeters of mercury.`;
  }
  const w = points[points.length - 1]!.weightKg;
  const kg = w?.toFixed(1) ?? '';
  return `Weight trend, ${rangeLabel}, ${points.length} readings from ${first} to ${last}. Latest ${kg} kilograms.`;
}

/** Short bullet lines for LLM visit prep (last 30d logs already scoped by caller). */
export function formatHealthTrendSummaryForPrompt(logs: HealthLog[]): string {
  const points = logsToVitalPoints(logs);
  const bp = points.filter((p) => p.kind === 'bp');
  const wt = points.filter((p) => p.kind === 'weight');
  const lines: string[] = [];
  if (bp.length >= 2) {
    const first = bp[0]!;
    const last = bp[bp.length - 1]!;
    lines.push(
      `Blood pressure: ${bp.length} readings; first ${first.systolicMmHg}/${first.diastolicMmHg} mmHg → latest ${last.systolicMmHg}/${last.diastolicMmHg} mmHg.`
    );
  } else if (bp.length === 1) {
    const p = bp[0]!;
    lines.push(`Blood pressure: single reading ${p.systolicMmHg}/${p.diastolicMmHg} mmHg.`);
  }
  if (wt.length >= 2) {
    const first = wt[0]!;
    const last = wt[wt.length - 1]!;
    lines.push(
      `Weight: ${wt.length} readings; first ${first.weightKg?.toFixed(1)} kg → latest ${last.weightKg?.toFixed(1)} kg.`
    );
  } else if (wt.length === 1) {
    lines.push(`Weight: single reading ${wt[0]!.weightKg?.toFixed(1)} kg.`);
  }
  return lines.join('\n');
}
