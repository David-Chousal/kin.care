import { useLayoutEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useTheme, type Theme } from '../../theme';
import type { AppLocale } from '../../i18n/appLocales';
import { useLocaleStore } from '../../store/locale';

const EXPLICIT_LOCALES: AppLocale[] = ['en', 'es', 'fr', 'de', 'ja', 'zh-Hans'];

const OPTION_LABEL_KEYS: Record<AppLocale, string> = {
  en: 'language.optionEnglish',
  es: 'language.optionSpanish',
  fr: 'language.optionFrench',
  de: 'language.optionGerman',
  ja: 'language.optionJapanese',
  'zh-Hans': 'language.optionChineseSimplified',
};

export function LanguageScreen() {
  const theme = useTheme();
  const styles = makeStyles(theme);
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const languagePreference = useLocaleStore((s) => s.languagePreference);
  const setLanguagePreference = useLocaleStore((s) => s.setLanguagePreference);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t('language.screenTitle') });
  }, [navigation, t, i18n.language]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t('language.screenTitle')}</Text>
          <TouchableOpacity
            style={[styles.row, languagePreference === 'system' && styles.rowActive]}
            onPress={() => setLanguagePreference('system')}
            activeOpacity={0.7}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.rowTitle, languagePreference === 'system' && styles.rowTitleActive]}>
                {t('language.optionSystem')}
              </Text>
              <Text style={styles.rowSub}>{t('language.rowSublabel')}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.innerDivider} />

          {EXPLICIT_LOCALES.map((code, index) => (
            <View key={code}>
              <TouchableOpacity
                style={[styles.row, languagePreference === code && styles.rowActive]}
                onPress={() => setLanguagePreference(code)}
                activeOpacity={0.7}
              >
                <Text style={[styles.rowTitle, languagePreference === code && styles.rowTitleActive]}>
                  {t(OPTION_LABEL_KEYS[code])}
                </Text>
              </TouchableOpacity>
              {index < EXPLICIT_LOCALES.length - 1 ? <View style={styles.innerDivider} /> : null}
            </View>
          ))}
        </View>

        <Text style={styles.hint}>{t('language.hint')}</Text>
      </ScrollView>
    </View>
  );
}

function makeStyles(t: Theme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    scrollContent: { padding: 20, paddingBottom: 56, gap: 16 },
    card: {
      backgroundColor: t.surface,
      borderRadius: 16,
      overflow: 'hidden',
      shadowColor: t.shadow,
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    cardTitle: { fontSize: 15, color: t.text, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
    row: { paddingHorizontal: 16, paddingVertical: 13 },
    rowActive: { backgroundColor: t.accentLight },
    rowTitle: { fontSize: 15, fontWeight: '600', color: t.text },
    rowTitleActive: { color: t.accent },
    rowSub: { fontSize: 12, color: t.textTertiary },
    innerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: t.border, marginLeft: 16 },
    hint: { fontSize: 13, lineHeight: 19, color: t.textTertiary, paddingHorizontal: 4 },
  });
}
