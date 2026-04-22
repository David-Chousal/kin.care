# Phase 2: RTL (Arabic + Hebrew)

## Scope

- Add locales `ar` and `he` (or `he-IL`) with full `translation` bundles.
- Enable RTL layout: React Native `I18nManager.allowRTL` / `forceRTL` (or Expo-supported patterns), direction-aware styles, mirrored margins/padding, and icon/chevron direction where semantics require it.
- Audit fixed `left`/`right` positioning, `flexDirection: 'row'` alignment, and custom drawings (SVG, gradients).

## Risks

- **Full reload may be required** after toggling RTL so native layout direction and font shaping stay consistent; document whether the product accepts an in-app restart prompt vs. requiring an OS-level app kill.
- **Mixed LTR/RTL** during incremental migration: embedded URLs, numbers, and proper names must use Unicode bidi isolates where needed.
- **QA surface area**: navigation stacks, modals, `ScrollView`/`FlatList` insets, `SafeAreaView` edges, date pickers, and third-party components that assume LTR.

## QA checklist (pre-release)

1. Cold start with device set to Arabic/Hebrew; confirm default **System** picks `ar`/`he` when added to the supported map.
2. Toggle explicit RTL locale in Settings; verify **reload behavior** matches product spec (no silent layout corruption).
3. Settings, Auth, Home: no clipped text, no overlapping chevrons, correct alignment of form labels and primary actions.
4. Export/share flows: plain-text export remains readable (LTR content inside RTL shell is acceptable if documented).
5. Screenshots for App Store / Play policy locales if required.

## Implementation notes

- Prefer logical CSS properties (`marginStart` / `marginEnd`) or RN `start`/`end` where available before blanket mirrors.
- Revisit `home` dashboard nav rows and frosted chrome for RTL-safe padding.
- Coordinate with any future web build: separate RTL CSS if a web target is added.
