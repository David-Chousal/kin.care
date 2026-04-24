import { View, Text, StyleSheet, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';
import type { Theme } from '../theme';

export type MinimalMarkdownVariant = 'visitPrep' | 'notes';

const VARIANT_SIZES = {
  visitPrep: { heading: 16, sectionTitle: 15, bullet: 14, body: 14, lh: 22 },
  notes: { heading: 16, sectionTitle: 15, bullet: 15, body: 15, lh: 22 },
} as const;

/** Nested `<Text>` fragments for use inside a single parent `<Text>`. */
function buildInlineNodes(
  line: string,
  baseStyle: TextStyle,
  theme: Theme,
  lineKey: string
): ReactNode[] {
  const children: ReactNode[] = [];
  const boldParts = line.split(/\*\*/);
  for (let i = 0; i < boldParts.length; i++) {
    const seg = boldParts[i] ?? '';
    if (seg === '' && i === boldParts.length - 1) continue;
    if (i % 2 === 0) {
      children.push(...italicToTextNodes(seg, baseStyle, theme, `${lineKey}-e${i}`));
    } else {
      const boldStyle: TextStyle[] = [baseStyle, { fontWeight: '700', color: theme.text }];
      children.push(
        <Text key={`${lineKey}-b${i}`} style={boldStyle}>
          {italicToTextNodes(seg, boldStyle, theme, `${lineKey}-bi${i}`)}
        </Text>
      );
    }
  }
  return children;
}

function italicToTextNodes(
  seg: string,
  baseStyle: TextStyle | TextStyle[],
  theme: Theme,
  keyBase: string
): React.ReactNode[] {
  const flatBase = Array.isArray(baseStyle) ? baseStyle : [baseStyle];
  const nodes: React.ReactNode[] = [];
  let rest = seg;
  let ni = 0;
  while (rest.length > 0) {
    const ia = rest.indexOf('*');
    if (ia === -1) {
      nodes.push(
        <Text key={`${keyBase}-t${ni++}`} style={flatBase}>
          {rest}
        </Text>
      );
      break;
    }
    if (ia > 0) {
      nodes.push(
        <Text key={`${keyBase}-t${ni++}`} style={flatBase}>
          {rest.slice(0, ia)}
        </Text>
      );
    }
    const after = rest.slice(ia + 1);
    const ia2 = after.indexOf('*');
    if (ia2 === -1) {
      nodes.push(
        <Text key={`${keyBase}-t${ni++}`} style={flatBase}>
          {`*${after}`}
        </Text>
      );
      break;
    }
    const inner = after.slice(0, ia2);
    nodes.push(
      <Text
        key={`${keyBase}-i${ni++}`}
        style={[...flatBase, { fontStyle: 'italic', color: theme.textSecondary }]}
      >
        {inner}
      </Text>
    );
    rest = after.slice(ia2 + 1);
  }
  return nodes;
}

/**
 * Line-based markdown (Visit Prep summaries) plus inline **bold** and *italic*
 * within body, bullets, and headings.
 */
export function renderMinimalMarkdown(
  text: string,
  theme: Theme,
  keyPrefix: string,
  variant: MinimalMarkdownVariant = 'visitPrep'
): React.ReactNode[] {
  const { heading, sectionTitle, bullet, body, lh } = VARIANT_SIZES[variant];
  const bodyColor = variant === 'notes' ? theme.text : theme.textSecondary;
  const bulletColor = variant === 'notes' ? theme.text : theme.textSecondary;
  const styles = StyleSheet.create({
    heading: { fontSize: heading, fontWeight: '700', marginTop: 8, lineHeight: lh + 2, color: theme.text },
    sectionTitle: {
      fontSize: sectionTitle,
      fontWeight: '700',
      marginTop: 12,
      lineHeight: lh + 2,
      color: theme.accent,
    },
    bullet: { fontSize: bullet, lineHeight: lh, color: bulletColor },
    body: { fontSize: body, lineHeight: lh, color: bodyColor },
  });

  const lines = text.split('\n');
  return lines.map((line, i) => {
    const key = `${keyPrefix}-line-${i}`;
    if (/^\*\*(.+)\*\*$/.test(line)) {
      const inner = line.replace(/\*\*/g, '');
      return (
        <Text key={key} style={styles.heading}>
          {italicToTextNodes(inner, styles.heading, theme, `${key}-h`)}
        </Text>
      );
    }
    if (/^\d+\.\s\*\*(.+)\*\*/.test(line)) {
      const num = line.match(/^\d+/)?.[0];
      const label = line.replace(/^\d+\.\s\*\*/, '').replace(/\*\*.*$/, '');
      return (
        <Text key={key} style={styles.sectionTitle}>
          {num}. {italicToTextNodes(label, styles.sectionTitle, theme, `${key}-st`)}
        </Text>
      );
    }
    if (/^#{1,3}\s/.test(line)) {
      const inner = line.replace(/^#{1,3}\s/, '');
      return (
        <Text key={key} style={styles.heading}>
          {italicToTextNodes(inner, styles.heading, theme, `${key}-hx`)}
        </Text>
      );
    }
    if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
      const raw = line.replace(/^[-•*]\s/, '');
      return (
        <Text key={key} style={styles.bullet}>
          {'  •  '}
          {buildInlineNodes(raw, styles.bullet, theme, `${key}-bl`)}
        </Text>
      );
    }
    if (line.trim() === '') return <View key={key} style={{ height: 8 }} />;
    return (
      <Text key={key} style={styles.body}>
        {buildInlineNodes(line, styles.body, theme, key)}
      </Text>
    );
  });
}
