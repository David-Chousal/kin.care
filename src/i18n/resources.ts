import en from './locales/en/translation.json';
import es from './locales/es/translation.json';
import fr from './locales/fr/translation.json';
import de from './locales/de/translation.json';
import ja from './locales/ja/translation.json';
import zhHans from './locales/zh-Hans/translation.json';
import { mergeTranslations } from './mergeTranslations';

const enTree = en as Record<string, unknown>;

export const resources = {
  en: { translation: en },
  es: { translation: mergeTranslations(enTree, es as Record<string, unknown>) },
  fr: { translation: mergeTranslations(enTree, fr as Record<string, unknown>) },
  de: { translation: mergeTranslations(enTree, de as Record<string, unknown>) },
  ja: { translation: mergeTranslations(enTree, ja as Record<string, unknown>) },
  'zh-Hans': { translation: mergeTranslations(enTree, zhHans as Record<string, unknown>) },
};
