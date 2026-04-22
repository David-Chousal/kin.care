import { useTranslation } from 'react-i18next';
import { getFormatLocaleTag } from './getFormatLocaleTag';

/** Active BCP-47-ish locale for `Intl` / `toLocaleDateString`. */
export function useFormatLocaleTag(): string {
  const { i18n } = useTranslation();
  return getFormatLocaleTag(i18n.language);
}
