import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Circle } from 'react-native-svg';
import type { Theme } from '../../theme';
import { decimateSeries, type NormalizedVitalPoint } from './healthVitalSignals';

const CHART_MAX_POINTS = 56;

export interface MiniTrendPalette {
  seriesA: string;
  seriesB: string;
  grid: string;
}

interface Props {
  title: string;
  subtitle: string;
  /** VoiceOver / TalkBack summary (not only color). */
  accessibilityLabel: string;
  kind: 'bp' | 'weight';
  points: NormalizedVitalPoint[];
  width: number;
  height: number;
  palette: MiniTrendPalette;
  t: Theme;
}

export function HealthLogMiniTrendChart({
  title,
  subtitle,
  accessibilityLabel,
  kind,
  points,
  width,
  height,
  palette,
  t,
}: Props) {
  const padL = 4;
  const padR = 8;
  const padT = 6;
  const padB = 14;
  const innerW = Math.max(1, width - padL - padR);
  const innerH = Math.max(1, height - padT - padB);

  if (width < 24 || height < 24) {
    return null;
  }

  const sample = decimateSeries(points, CHART_MAX_POINTS);
  const times = sample.map((p) => new Date(p.loggedAt).getTime());
  const tMin = Math.min(...times);
  const tMax = Math.max(...times);
  const tSpan = Math.max(1, tMax - tMin);

  const xAt = (ts: number) => padL + ((ts - tMin) / tSpan) * innerW;

  if (kind === 'bp') {
    const sys = sample.map((p) => p.systolicMmHg!).filter((n) => Number.isFinite(n));
    const dia = sample.map((p) => p.diastolicMmHg!).filter((n) => Number.isFinite(n));
    const yMin = Math.min(...sys, ...dia) - 4;
    const yMax = Math.max(...sys, ...dia) + 4;
    const ySpan = Math.max(1, yMax - yMin);
    const yAt = (v: number) => padT + (1 - (v - yMin) / ySpan) * innerH;

    const ptsSys = sample.map((p) => `${xAt(new Date(p.loggedAt).getTime())},${yAt(p.systolicMmHg!)}`).join(' ');
    const ptsDia = sample.map((p) => `${xAt(new Date(p.loggedAt).getTime())},${yAt(p.diastolicMmHg!)}`).join(' ');

    return (
      <View
        style={styles.card}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: t.textTertiary }]}>{subtitle}</Text>
        </View>
        <View style={styles.legendRow}>
          <Text style={[styles.legend, { color: palette.seriesA }]}>● Sys</Text>
          <Text style={[styles.legend, { color: palette.seriesB }]}>◆ Dia</Text>
        </View>
        <View accessible={false}>
        <Svg width={width} height={height}>
          <Line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke={palette.grid} strokeWidth={1} />
          <Polyline points={ptsSys} fill="none" stroke={palette.seriesA} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Polyline
            points={ptsDia}
            fill="none"
            stroke={palette.seriesB}
            strokeWidth={2}
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {sample.length === 1 ? (
            <>
              <Circle cx={xAt(times[0]!)} cy={yAt(sample[0]!.systolicMmHg!)} r={4} fill={palette.seriesA} />
              <Circle cx={xAt(times[0]!)} cy={yAt(sample[0]!.diastolicMmHg!)} r={3} fill={palette.seriesB} />
            </>
          ) : null}
        </Svg>
        </View>
      </View>
    );
  }

  const wts = sample.map((p) => p.weightKg!).filter((n) => Number.isFinite(n));
  const yMin = Math.min(...wts) - 0.5;
  const yMax = Math.max(...wts) + 0.5;
  const ySpan = Math.max(0.01, yMax - yMin);
  const yAt = (v: number) => padT + (1 - (v - yMin) / ySpan) * innerH;
  const pts = sample.map((p) => `${xAt(new Date(p.loggedAt).getTime())},${yAt(p.weightKg!)}`).join(' ');

  return (
    <View style={styles.card} accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.cardHeader}>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        <Text style={[styles.subtitle, { color: t.textTertiary }]}>{subtitle}</Text>
      </View>
      <View style={styles.legendRow}>
        <Text style={[styles.legend, { color: palette.seriesA }]}>● Weight (kg)</Text>
      </View>
      <View accessible={false}>
        <Svg width={width} height={height}>
          <Line x1={padL} y1={padT + innerH} x2={padL + innerW} y2={padT + innerH} stroke={palette.grid} strokeWidth={1} />
          <Polyline points={pts} fill="none" stroke={palette.seriesA} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          {sample.length === 1 ? <Circle cx={xAt(times[0]!)} cy={yAt(sample[0]!.weightKg!)} r={4} fill={palette.seriesA} /> : null}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500' },
  legendRow: { flexDirection: 'row', gap: 14, marginBottom: 2 },
  legend: { fontSize: 11, fontWeight: '600' },
});
