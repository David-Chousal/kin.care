import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { APP_LOCALES } from './appLocales';
import { resources } from './resources';

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  supportedLngs: [...APP_LOCALES],
  defaultNS: 'translation',
  ns: ['translation'],
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  parseMissingKeyHandler: (key) => {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing key: ${key}`);
    }
    return key;
  },
  react: { useSuspense: false },
});

export { i18n };
