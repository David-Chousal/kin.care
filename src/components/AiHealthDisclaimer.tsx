import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme, typography } from '../theme';
import { Icon } from './Icon';

export type AiHealthDisclaimerKind = 'visit_prep' | 'drug_interactions' | 'generic';

type Props = {
  kind?: AiHealthDisclaimerKind;
  style?: object;
};

export function AiHealthDisclaimer({ kind = 'generic' }: Props) {
  const t = useTheme();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { t: tr } = useTranslation();
  const [open, setOpen] = useState(false);

  const verifyLabel =
    kind === 'drug_interactions'
      ? tr('aiHealth.verifyPharmacistOrClinician')
      : tr('aiHealth.verifyClinician');

  return (
    <>
      <View style={styles.card} accessibilityRole="summary">
        <View style={styles.headerRow}>
          <View style={styles.iconWrap} accessibilityElementsHidden>
            <Icon name="info" size={14} color={t.textSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{tr('aiHealth.title')}</Text>
            <Text style={styles.body}>
              {tr('aiHealth.short', { verifyLabel })}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={tr('aiHealth.learnMore')}
          >
            <Text style={styles.learnMore}>{tr('aiHealth.learnMore')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)} />
          <View style={styles.modalCard} accessibilityRole="dialog">
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Icon name="info" size={18} color={t.accent} />
                <Text style={styles.modalTitle}>{tr('aiHealth.modalTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button">
                <Text style={styles.modalDone}>{tr('common.cancel')}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLine}>{tr('aiHealth.details.informationalOnly')}</Text>
              <Text style={styles.modalLine}>{tr('aiHealth.details.mayBeWrong')}</Text>
              <Text style={styles.modalLine}>
                {tr('aiHealth.details.noMedChanges', { verifyLabel })}
              </Text>
              <Text style={styles.modalLine}>{tr('aiHealth.details.emergency')}</Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    card: {
      backgroundColor: t.surface,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderLight,
      padding: 12,
    },
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    iconWrap: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: t.borderLight + '30',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    title: { ...typography.footnote, fontWeight: '700', color: t.text },
    body: { ...typography.footnote, color: t.textSecondary, marginTop: 2, lineHeight: 18 },
    learnMore: { ...typography.footnote, color: t.accent, fontWeight: '700', marginLeft: 10, marginTop: 1 },

    modalRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
    modalCard: {
      width: '100%',
      maxWidth: 420,
      borderRadius: 16,
      backgroundColor: t.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.borderLight,
      overflow: 'hidden',
    },
    modalHeader: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.borderLight,
    },
    modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, marginRight: 12 },
    modalTitle: { ...typography.subhead, color: t.text, fontWeight: '800', flexShrink: 1 },
    modalDone: { ...typography.callout, color: t.accent, fontWeight: '700' },
    modalBody: { padding: 16, gap: 10 },
    modalLine: { ...typography.footnote, color: t.textSecondary, lineHeight: 20 },
  });
}

