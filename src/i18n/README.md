# i18n

## Libraries

- `i18next` + `react-i18next` — runtime translations and React bindings.
- `expo-localization` — device `languageTag` list (used when preference is **System**).

## Key convention

- One namespace: `translation` (default).
- Keys use **dot-separated paths** matching the JSON tree, grouped by feature:
  - `settings.*` — Settings and sub-screens (e.g. `settings.sections.account`, `settings.export.title`).
  - `auth.*` — Welcome, sign-in, sign-up (`auth.signIn.email`, `auth.welcome.slide1Headline`).
  - `home.*` — Home dashboard (`home.nav.tasks.label`, `home.attention.overdueTasks` with plural forms).
  - `language.*` — Language picker screen.
  - `common.*` — Shared short strings (`common.cancel`, `common.save`).

Plural keys follow i18next suffixes: `home.attention.overdueTasks_one`, `home.attention.overdueTasks_other`, used as `t('home.attention.overdueTasks', { count })`.

## Locale codes

Persisted / `i18n` language codes: `en`, `es`, `fr`, `de`, `ja`, `zh-Hans`. Mapping from OS tags is in `mapLanguageTagsToSupportedLocale.ts`.

## Fallbacks

- `fallbackLng: 'en'`.
- `parseMissingKeyHandler` logs in `__DEV__` and returns the key string so the app does not crash on missing keys.

## System language

When the user selects **System**, the resolved locale is taken from `expo-localization` on each app launch (and whenever the in-app preference is **System**). **Changing the OS language while the app stays in the background is applied on the next cold start**, not live-mapped from the OS mid-session.
