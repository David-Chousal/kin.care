import { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutChangeEvent,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useTheme, type Theme } from '../../theme';
import { useFamilyStore } from '../../store/family';
import { useHealthLogTrends, HEALTH_LOG_TRENDS_MAX_ROWS } from './hooks/useHealthLogTrends';
import {
  logsToVitalPoints,
  filterPointsInRange,
  trendRangeBounds,
  trendSummaryA11yLabel,
  type HealthTrendRange,
} from './healthVitalSignals';
import { HealthLogMiniTrendChart, type MiniTrendPalette } from './HealthLogMiniTrendChart';
import { errorMessageFromUnknown } from '../../lib/errorMessage';

const RANGE_OPTIONS: Array<{ key: HealthTrendRange; label: string }> = [
  { key: '7d', label: '7d' },
  { key: '30d', label: 'Month' },
  { key: '365d', label: 'Year' },
  { key: 'all', label: 'All' },
];

export function HealthLogTrendSection() {
  const t = useTheme();
  const styles = makeStyles(t);
  const family = useFamilyStore((s) => s.family);
  const [range, setRange] = useState<HealthTrendRange>('7d');
  const { data: logs = [], isLoading, isError, error, refetch, isFetching } = useHealthLogTrends(range);

  if (!family?.id) return null;
  const [chartW, setChartW] = useState(320);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setChartW(Math.floor(w));
  }, []);

  const { start, end } = useMemo(() => trendRangeBounds(range), [range]);

  const allPoints = useMemo(() => logsToVitalPoints(logs), [logs]);
  const pointsInRange = useMemo(
    () => filterPointsInRange(allPoints, start, end),
    [allPoints, start, end]
  );
  const bpPoints = useMemo(() => pointsInRange.filter((p) => p.kind === 'bp'), [pointsInRange]);
  const weightPoints = useMemo(() => pointsInRange.filter((p) => p.kind === 'weight'), [pointsInRange]);

  const rangeLabel = RANGE_OPTIONS.find((o) => o.key === range)?.label ?? range;
  const chartHeight = 104;
  const palette: MiniTrendPalette = {
    seriesA: t.accent,
    seriesB: t.textSecondary,
    grid: t.borderLight,
  };

  const bpSubtitle =
    bpPoints.length === 0
      ? '—'
      : `${bpPoints[bpPoints.length - 1]!.systolicMmHg}/${bpPoints[bpPoints.length - 1]!.diastolicMmHg} mmHg`;
  const wtSubtitle =
    weightPoints.length === 0
      ? '—'
      : `${(weightPoints[weightPoints.length - 1]!.weightKg ?? 0).toFixed(1)} kg`;

  const truncated = logs.length >= HEALTH_LOG_TRENDS_MAX_ROWS;

  return (
    <View style={styles.wrap} onLayout={onLayout}>
      <Text style={styles.sectionTitle}>Trends</Text>
      <Text style={styles.sectionHint}>Blood pressure and weight from your log (local dates).</Text>

      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.rangeChip, range === key && styles.rangeChipActive]}
            onPress={() => setRange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: range === key }}
            accessibilityLabel={`Time range ${label}`}
          >
            <Text style={[styles.rangeText, range === key && styles.rangeTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={t.accent} />
          <Text style={styles.loadingText}>Loading trends…</Text>
        </View>
      ) : isError ? (
        <Pressable onPress={() => refetch()} style={styles.errorBox} accessibilityRole="button">
          <Text style={styles.errorText}>{errorMessageFromUnknown(error)}</Text>
          <Text style={styles.retryText}>Tap to retry</Text>
        </Pressable>
      ) : (
        <>
          {bpPoints.length > 0 ? (
            <HealthLogMiniTrendChart
              title="Blood pressure"
              subtitle={bpSubtitle}
              accessibilityLabel={trendSummaryA11yLabel('bp', bpPoints, rangeLabel)}
              kind="bp"
              points={bpPoints}
              width={chartW}
              height={chartHeight}
              palette={palette}
              t={t}
            />
          ) : (
            <View style={styles.emptyBlock} accessibilityRole="text">
              <Text style={styles.emptyTitle}>No blood pressure in this range</Text>
              <Text style={styles.emptyBody}>
                Add a vital with title “Blood pressure” and a value like 120/80.
              </Text>
            </View>
          )}

          {weightPoints.length > 0 ? (
            <HealthLogMiniTrendChart
              title="Weight"
              subtitle={wtSubtitle}
              accessibilityLabel={trendSummaryA11yLabel('weight', weightPoints, rangeLabel)}
              kind="weight"
              points={weightPoints}
              width={chartW}
              height={chartHeight}
              palette={palette}
              t={t}
            />
          ) : (
            <View style={styles.emptyBlock} accessibilityRole="text">
              <Text style={styles.emptyTitle}>No weight in this range</Text>
              <Text style={styles.emptyBody}>
                Add a vital with title “Weight” and a value (kg or lb).
              </Text>
            </View>
          )}

          {truncated ? (
            <Text style={styles.truncNote}>
              Showing the first {HEALTH_LOG_TRENDS_MAX_ROWS} entries in range for speed. Narrow the range if needed.
            </Text>
          ) : null}
          {isFetching && !isLoading ? (
            <View style={styles.refreshHint}>
              <ActivityIndicator size="small" color={t.textTertiary} />
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrap: {
      marginBottom: 8,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: t.text, marginBottom: 4 },
    sectionHint: { fontSize: 12, color: t.textTertiary, marginBottom: 10 },
    rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    rangeChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: t.surfaceAlt,
    },
    rangeChipActive: { backgroundColor: t.accent },
    rangeText: { fontSize: 13, color: t.textSecondary, fontWeight: '600' },
    rangeTextActive: { color: t.surface },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
    loadingText: { fontSize: 14, color: t.textSecondary },
    errorBox: { padding: 12, borderRadius: 12, backgroundColor: t.errorSurface, marginBottom: 8 },
    errorText: { fontSize: 14, color: t.error, fontWeight: '600' },
    retryText: { fontSize: 13, color: t.textSecondary, marginTop: 4 },
    emptyBlock: { paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8 },
    emptyTitle: { fontSize: 14, fontWeight: '600', color: t.textSecondary },
    emptyBody: { fontSize: 12, color: t.textTertiary, marginTop: 4, lineHeight: 18 },
    truncNote: { fontSize: 11, color: t.warning, marginTop: 4, marginBottom: 4 },
    refreshHint: { alignItems: 'center', paddingVertical: 4 },
  });
}
