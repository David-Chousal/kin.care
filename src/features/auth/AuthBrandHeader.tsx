import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { makeAuthChromeStyles } from './authScreenStyles';

/** Kin wordmark block: name + tagline (no circular mark). */
export function AuthBrandHeader() {
  const t = useTheme();
  const { t: tx } = useTranslation();
  const styles = useMemo(() => makeAuthChromeStyles(t), [t]);

  return (
    <View style={styles.brand} accessibilityRole="header">
      <Text style={styles.appName}>{tx('auth.brand.name')}</Text>
      <Text style={styles.tagline}>{tx('auth.brand.tagline')}</Text>
    </View>
  );
}
