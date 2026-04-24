## Store privacy mapping (Apple App Privacy + Google Data Safety)

This document is a **code-based data inventory** for Kin and a **paste-ready checklist** for App Store Connect and Google Play Console privacy disclosures.

### Scope (where this comes from)

- **Supabase (first-party backend/service provider)**: Postgres tables in `.claude/schema.sql` and migrations in `supabase/migrations/**`; file uploads in `src/features/**` via `supabase.storage`.
- **Third-party service providers**
  - **Groq (LLM)**: `supabase/functions/llm-gateway/index.ts` (visit prep + drug interactions).
  - **Expo Push API (push delivery)**: `supabase/functions/send-task-push/index.ts`.
  - **Sentry (crash + performance)**: `src/lib/sentry.ts` and `App.tsx`.
  - **RxNorm (NLM)**: `src/features/medications/services/drugInteractionService.ts` (drug name lookup + interactions).

Assumptions/decisions (confirmed):

- **Tracking/ads/attribution**: **No** (no IDFA/GAID usage, ad networks, install attribution SDKs).
- **LLM training/retention**: **No training**; minimize retention with provider.

---

## 1) Data inventory (collected/stored/transmitted)

### A. Account & identity (PII)

- **Email address**: stored in `public.profiles.email` (`.claude/schema.sql`)
- **Name** (optional): stored in `public.profiles.full_name`
- **Profile picture** (optional): image file in Supabase Storage bucket `profile-avatars` (**public bucket by explicit decision**); object path stored in `public.profiles.avatar_url` (resolved to a public URL in the app)
- **User ID** (Supabase auth UUID): stored as `public.profiles.id` and referenced widely as FK (e.g., tasks assignee, created_by fields)
- **Invitations**: stored in `public.invitations.email`, `public.invitations.token` (UUID), `accepted`

### B. Family/care context (PII / sensitive depending on content)

- **Family name**: `public.families.name`
- **Care recipient name**: `public.families.care_recipient_name`
- **Family membership + role**: `public.family_members.user_id`, `public.family_members.role`

### C. Health & fitness (sensitive; can be PHI)

- **Medications** (name/dose/frequency/times/notes + refill tracking): `public.medications.*` + migrations for structured frequency and refill tracking
- **Medication adherence logs** (scheduled/taken times, status, notes): `public.medication_logs.*`
- **Health logs** (symptoms/vitals/mood/notes + optional photo reference): `public.health_logs.*` + `photo_path` migration
- **Check-ins** (mood/summary/notes): `public.checkins.*`
- **Doctors** (name/phone/address): `public.family_doctors.*`

### D. User-generated content (may include PII/PHI)

- **Tasks** (title/description, assignee, due date): `public.tasks.*`
- **Calendar events** (title/description/location, times): `public.calendar_events.*`
- **Family notes** (free text): `public.family_notes.body`
- **Documents metadata** (name, category, file path/type/size): `public.documents.*`
- **AI-generated visit prep summaries** (free text): `public.visit_prep_summaries.content`

### E. Photos / files

- **Health log photos**: uploaded to Supabase Storage bucket `health-log-photos`; referenced by `public.health_logs.photo_path` (`src/features/health/hooks/useHealthLogs.ts`)
- **Profile pictures**: uploaded to Supabase Storage bucket `profile-avatars` (**public bucket**); path stored in `public.profiles.avatar_url` (`src/features/profile/profileAvatarStorage.ts`, Settings)
- **Documents**: uploaded to Supabase Storage bucket `documents`; referenced by `public.documents.file_path` (`src/features/documents/hooks/useDocuments.ts`)

### F. Identifiers (device/app)

- **Push token** (Expo push token): stored in `public.push_tokens.token` linked to `user_id` (`src/features/notifications/usePushToken.ts`)

### G. Diagnostics + security logging

- **LLM gateway logs**: stored in `public.llm_requests` (purpose/model params, request/response sizes, optional provider **token counts** (`prompt_tokens`, `completion_tokens`, `total_tokens`), prompt hash, latency, status, truncated error message, best-effort **client IP**, optional `family_id`) (`supabase/migrations/20260422120000_llm_gateway_rate_limits_and_logs.sql`, `supabase/migrations/20260422140000_llm_gateway_tokens_budget_family.sql`, `supabase/functions/llm-gateway/index.ts`)
- **Rate limit counters**: stored in `public.llm_rate_limits` (counts/timestamps)
- **Crash reporting + performance**: sent to **Sentry** with `tracesSampleRate` and **`attachScreenshot: true`** (`src/lib/sentry.ts`)

### H. Local device storage (AsyncStorage)

Stored locally (non-PII preferences and notification schedule bookkeeping):

- **Notification preferences + last OS permission status**: `kin-notification-prefs` (`src/store/notifications.ts`)
- **Scheduled notification IDs for calendar reminders**: `kin:scheduled_notifications:v1` (`src/lib/calendarEventReminders.ts`)
- **Theme preference**: `kin-theme` (`src/store/theme.ts`)
- **Locale preference**: `kin-locale` (`src/store/locale.ts`)
- **Accessibility preference (haptics enabled)**: `kin-accessibility` (`src/store/accessibility.ts`)

---

## 2) Apple App Privacy mapping (categories, purposes, linked, tracking, shared)

Global for this app:

- **Used for tracking**: **No** (for all categories)

### Apple disclosure checklist (strict / safest interpretation)

Use this if you want to be conservative: anything sent to service providers counts as **Shared**; anything stored server-side is **Collected**.

- **Contact Info**
  - **Email Address** — **Collected**; **Linked to user: Yes**; **Shared: Yes (service providers)**; **Purpose**: App Functionality (account), Security.
  - **Name** — **Collected**; **Linked: Yes**; **Shared: Yes (service providers)**; **Purpose**: App Functionality (profiles, collaboration).
- **Health & Fitness**
  - **Health data** (medications, vitals/symptoms/mood logs, check-ins, doctor contact details) — **Collected**; **Linked: Yes**; **Shared: Yes (service providers, incl. LLM when used)**; **Purpose**: App Functionality, Product Personalization (visit prep), Diagnostics (limited).
- **User Content**
  - **User content** (tasks, calendar text/location, family notes, documents metadata, AI summaries) — **Collected**; **Linked: Yes**; **Shared: Yes (service providers; LLM for visit prep)**; **Purpose**: App Functionality, Product Personalization.
- **Photos or Videos**
  - **Photos** (health log photos; profile pictures; potentially document images/PDF previews) — **Collected**; **Linked: Yes**; **Shared: Yes (service providers)**; **Purpose**: App Functionality.
- **Identifiers**
  - **User ID** (auth UUID) — **Collected**; **Linked: Yes**; **Shared: Yes (service providers)**; **Purpose**: App Functionality, Security.
  - **Device ID / Other ID** (Expo push token) — **Collected**; **Linked: Yes**; **Shared: Yes (Expo for delivery)**; **Purpose**: App Functionality (push).
- **Diagnostics**
  - **Crash data** — **Collected**; **Linked: Potentially** (if you ever attach user context; currently no `setUser` found, but crashes may still be linkable); **Shared: Yes (Sentry)**; **Purpose**: Diagnostics.
  - **Performance data** — **Collected**; **Linked: Potentially**; **Shared: Yes (Sentry)**; **Purpose**: App Analytics/Performance.
  - **Other diagnostic data** (LLM request logs incl. IP) — **Collected**; **Linked: Yes**; **Shared: No (stored in your Supabase)**; **Purpose**: Security, Diagnostics.
- **Other Data**
  - **Invite token** — **Collected**; **Linked: Yes** (to family + invitee email); **Shared: No (internal)**; **Purpose**: App Functionality (invites).

### Apple disclosure checklist (processor-only / less strict interpretation)

Use this only if you decide Apple’s “shared with third parties” should exclude **service providers processing on your behalf**. In that case, for Groq/Sentry/Expo you may mark **Shared: No** (but still disclose as **Collected** and describe purposes).

---

## 3) Google Play Data Safety mapping (data types, purposes, shared, handling)

Default handling (to validate in console):

- **Encrypted in transit**: **Yes** (HTTPS to Supabase/Groq/Sentry/Expo/RxNorm).
- **Sold**: **No**.
- **Used for advertising**: **No**.

### Google disclosure checklist (what to enter)

Mark as **Collected** when stored in Supabase tables/storage or transmitted to providers during feature use. Mark as **Shared** when sent to a third-party service provider.

- **Personal info**
  - **Name** — Collected (Supabase); Shared (Expo push message body may include assigner name; Sentry optional); Purpose: App functionality.
  - **Email address** — Collected (Supabase); Shared (Expo push message body fallback to email; Sentry optional); Purpose: App functionality.
- **Health & fitness**
  - **Health info** (medications, symptoms/vitals/mood, check-ins, doctor info) — Collected (Supabase); Shared (**Groq** when using visit prep / AI interaction checks); Purpose: App functionality, Personalization.
- **Photos and videos**
  - **Photos** (health log photos; profile pictures) — Collected (Supabase Storage); Shared (Supabase as service provider); Purpose: App functionality.
- **Files and docs**
  - **Files** (uploaded documents) — Collected (Supabase Storage); Shared (Supabase as service provider); Purpose: App functionality.
- **App activity**
  - **Tasks + calendar events + notes** — Collected (Supabase); Shared (Expo push payload includes task title + IDs; Groq for visit prep summary inputs are derived from meds/logs); Purpose: App functionality.
- **Device or other IDs**
  - **Push token** — Collected (Supabase); Shared (**Expo**); Purpose: App functionality (notifications).
- **Diagnostics**
  - **Crash logs** — Collected/Shared (**Sentry**); Purpose: Diagnostics.
  - **Performance data** — Collected/Shared (**Sentry**); Purpose: Analytics.
  - **Server request logs** (LLM request metadata + IP) — Collected (Supabase); Purpose: Security, Diagnostics.

---

## 4) Paste-ready console entry checklist

### App Store Connect (Apple) — “Data Used to Track You”

- **Tracking**: **No**

### App Store Connect (Apple) — “Data Linked to You” (recommended strict set)

- **Contact Info**: Email Address, Name
- **Health & Fitness**: Health (medications, health logs, check-ins, doctors)
- **User Content**: Photos (health photos, profile pictures), Other user content (tasks/calendar/notes/docs/AI summaries)
- **Identifiers**: User ID, Device ID (push token)
- **Diagnostics**: Crash Data, Performance Data, Other Diagnostic Data

Purposes (apply per data type):

- **App Functionality**: Contact info, health data, user content, files/photos, identifiers, push tokens
- **Product Personalization**: Visit prep summaries (LLM)
- **Diagnostics**: Sentry crash reports/screenshots; server error logs
- **App Analytics/Performance**: Sentry performance traces
- **Security**: rate limiting + request logging

### Google Play Console — Data Safety (sections to check)

- **Collected**: Yes (for the categories listed above)
- **Shared**: Yes (Groq, Sentry, Expo, RxNorm, Supabase are service providers; at minimum Groq/Sentry/Expo/RxNorm are third-party endpoints)
- **Purposes**:
  - App functionality
  - Analytics (Sentry performance)
  - Developer communications (push notifications)
  - Fraud prevention, security, compliance (rate limiting/logs)
  - Personalization (visit prep)

---

## 5) Known verification items (affects “deletion” + accuracy)

- **Account deletion (implemented)**: in-app “Delete account” calls `supabase/functions/delete-account` (Option A).
  - **Deletes `auth.users`** (cascades: `public.profiles`, `public.llm_requests`, `public.llm_rate_limits`, `public.family_notes`).
  - For families where the user is the **only member**: deletes the `families` row (DB cascades) and deletes all Storage objects in `documents` + `health-log-photos` for that family prefix.
  - For families with other members: removes membership and deletes the user’s created content within that family (tasks, calendar events, meds, check-ins, doctors, visit prep summaries, health logs + photos, documents + files), and de-attributes medication logs.
  - **Profile pictures**: deletes all Storage objects under `profile-avatars/{user_id}/` before removing the auth user.
  - **Store impact**: you can represent **in-product account deletion** as supported in Google Data Safety.
- **Sentry screenshots**: `attachScreenshot: true` can capture on-screen personal/health info at crash time; confirm you want this enabled for production.
- **Groq data retention**: ensure provider settings/contract reflect “no training” and acceptable retention.

---

## 6) OS permissions manifest (Expo prebuild / store compliance)

Regenerate with `npx expo prebuild` when native dependencies change. Kin uses **Continuous Native Generation** (`app.json` + config plugins); merged Gradle output may add more permissions than `android/app/src/main/AndroidManifest.xml` alone.

### iOS (`ios/**/Info.plist` after prebuild)

- **Present (non-privacy)**: `ITSAppUsesNonExemptEncryption`, URL schemes (`kincare`), ATS, New Arch flag, orientation, etc.
- **Privacy usage strings (`NS*UsageDescription`)**: **`expo-image-picker`** (profile picture in Settings) adds **photo library** and **camera** usage strings via `app.json` config plugin. Document picking still uses `expo-document-picker` (document UI). Notifications do not require a plist usage string per Expo.
- **Push / background**: `expo-notifications` is configured with **`enableBackgroundRemoteNotifications`: false** in `app.json` unless you intentionally need silent remote wake. Enable only if product uses data-only / `content-available` pushes.

### Android — `android/app/src/main/AndroidManifest.xml` (Expo template)

| Permission | Typical source / justification |
|------------|--------------------------------|
| `INTERNET` | Networking (Supabase, Sentry, etc.) |
| `VIBRATE` | Notification vibration |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | **`expo-file-system`** (transitive); used for file/cache paths. On modern Android these are often scoped/no-op for app sandbox; do **not** remove without verifying document upload + `copyToCacheDirectory` flows. |
| `SYSTEM_ALERT_WINDOW` | Dev / RN overlay (often debug; confirm release variant) |

### Android — merged from `expo-notifications` (`node_modules/expo-notifications/android/.../AndroidManifest.xml`)

| Permission | Role |
|------------|------|
| `RECEIVE_BOOT_COMPLETED` | Reschedule / restore notification behavior after reboot |
| `POST_NOTIFICATIONS` | Android 13+ user opt-in for notifications |

The app creates channels **`default`** (matches FCM default meta + `app.json` plugin `defaultChannel`) and **`reminders`** (local calendar reminders) **before** `getExpoPushTokenAsync` / `requestPermissionsAsync` on Android, per Expo guidance.

### Exact alarms (`SCHEDULE_EXACT_ALARM`)

**Not** declared by `expo-notifications` in the installed SDK’s library manifest (verify with `./gradlew :app:processReleaseMainManifest` if a release merge adds it). Local calendar reminders use **date** triggers (`calendarEventReminders`). **If** Play Console or merged manifest later shows `SCHEDULE_EXACT_ALARM` or `USE_EXACT_ALARM`, declare under **App content → Sensitive app permissions → Alarms & reminders** with justification: *user-scheduled calendar event reminders at a specific local time*. If alarms are unreliable without that permission, add it deliberately (and re-verify minimization).

### Minimization checklist

- iOS **`NSPhotoLibraryUsageDescription` / `NSCameraUsageDescription`**: declared via **`expo-image-picker`** for optional profile-picture capture/selection in Settings; keep strings accurate if UX changes.
- Use **`android.blockedPermissions`** in `app.json` only for permissions proven unused after a full release manifest diff (do not block notification or boot permissions while those features are active).

