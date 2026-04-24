import { useState } from 'react';
import { View, TextInput, TouchableOpacity, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import type { makeAuthStyles } from './authStyles';

type Styles = ReturnType<typeof makeAuthStyles>;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  placeholderColor: string;
  styles: Styles;
  accessibilityLabel: string;
  accessibilityHint?: string;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
};

export function AuthPasswordField({
  value,
  onChangeText,
  placeholder,
  placeholderColor,
  styles,
  accessibilityLabel,
  accessibilityHint,
  returnKeyType,
  onSubmitEditing,
}: Props) {
  const [visible, setVisible] = useState(false);
  const { t: tx } = useTranslation();
  const t = useTheme();

  return (
    <View style={styles.inputRow}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      />
      <TouchableOpacity
        style={styles.inputSuffixBtn}
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? tx('auth.password.hideA11y') : tx('auth.password.showA11y')}
        hitSlop={8}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={t.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}
