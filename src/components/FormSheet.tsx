import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  useTheme,
  spacing,
  space,
  radius,
  type Theme,
  navigationTitleTextStyle,
  typography,
  NAVIGATION_HEADER_TOOLBAR,
  NAVIGATION_HEADER_CHROME_PAD,
} from '../theme';
import { BlurredHeaderBar } from './BlurredHeaderBar';

interface FormSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitDisabled?: boolean;
  /** true = semi-transparent overlay (slide-up sheet). false = native page sheet (default). */
  transparent?: boolean;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function FormSheet({
  visible,
  onClose,
  onSubmit,
  title,
  submitLabel = 'Save',
  isSubmitting = false,
  submitDisabled = false,
  transparent = false,
  children,
  contentContainerStyle,
}: FormSheetProps) {
  const t = useTheme();
  const styles = makeStyles(t);

  const body = (
    <View style={transparent ? styles.sheet : styles.sheetFull}>
      <View style={styles.dragHandle} />
      <BlurredHeaderBar style={styles.headerBar} contentStyle={styles.headerBarInner}>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.sheetTitle}>{title}</Text>
        <TouchableOpacity
          onPress={onSubmit}
          disabled={isSubmitting || submitDisabled}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={t.accent} />
          ) : (
            <Text style={[styles.saveText, submitDisabled && styles.saveDisabled]}>
              {submitLabel}
            </Text>
          )}
        </TouchableOpacity>
      </BlurredHeaderBar>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.formContent, contentContainerStyle]}
      >
        {children}
      </ScrollView>
    </View>
  );

  if (transparent) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {body}
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      {body}
    </Modal>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: t.overlay,
    },
    sheet: {
      backgroundColor: t.surface,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingBottom: spacing.xxxl + spacing.sm,
      maxHeight: '92%',
    },
    sheetFull: {
      flex: 1,
      backgroundColor: t.surface,
    },
    dragHandle: {
      // layout-exception: system sheet drag affordance (~36pt wide)
      width: space[6] + space[1],
      height: space[1],
      borderRadius: 2,
      backgroundColor: t.borderLight,
      alignSelf: 'center',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    headerBar: {
      paddingHorizontal: spacing.xl,
      paddingBottom: NAVIGATION_HEADER_CHROME_PAD,
    },
    headerBarInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: NAVIGATION_HEADER_TOOLBAR,
    },
    cancelText: {
      ...typography.callout,
      color: t.textSecondary,
      minWidth: 56,
    },
    sheetTitle: {
      ...navigationTitleTextStyle(t),
      flex: 1,
      textAlign: 'center',
    },
    saveText: {
      ...typography.callout,
      color: t.accent,
      fontWeight: '600',
      minWidth: 56,
      textAlign: 'right',
    },
    saveDisabled: {
      opacity: 0.4,
    },
    formContent: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
  });
}
