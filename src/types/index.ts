export type UserRole = 'admin' | 'member' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  /** Storage path in bucket `profile-avatars` (`{user_id}/filename`); resolve with `getPublicUrl`. */
  avatar_url: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  care_recipient_name: string;
  created_by: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
  profile?: Profile;
}

export interface Task {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  /** Joined from profiles when fetched via useTasks (select includes !assigned_to join). */
  assigned_profile?: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'> | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  family_id: string;
  email: string;
  role: UserRole;
  token: string;
  accepted: boolean;
  expires_at: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  created_by: string;
  created_at: string;
}

export type MedicationFrequencyType = 'daily' | 'weekly' | 'as_needed';

export interface Medication {
  id: string;
  family_id: string;
  name: string;
  dosage: string;
  /** Display label; schedule logic prefers {@link frequency_type} when present (after DB migration). */
  frequency: string;
  /** Present when `medications` migration has run; otherwise infer from {@link frequency} + {@link times}. */
  frequency_type?: MedicationFrequencyType;
  times_per_day?: number | null;
  days_of_week?: number[] | null;
  times: string[] | null;
  notes: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  /** Current pill/unit count. NULL means refill tracking is disabled for this medication. */
  quantity_remaining: number | null;
  /** Send a refill alert when quantity_remaining drops to this value. NULL = no alert. */
  refill_threshold: number | null;
}

export type MedicationLogStatus = 'taken' | 'missed' | 'pending';

export interface MedicationLog {
  id: string;
  medication_id: string;
  family_id: string;
  scheduled_at: string;
  taken_at: string | null;
  status: MedicationLogStatus;
  logged_by: string | null;
  notes: string | null;
  created_at: string;
}

export type HealthLogCategory = 'symptom' | 'vital' | 'mood' | 'note';

export interface HealthLog {
  id: string;
  family_id: string;
  category: HealthLogCategory;
  title: string;
  value: string | null;
  unit: string | null;
  notes: string | null;
  /** Storage object path in bucket `health-log-photos` (family_id/…). */
  photo_path?: string | null;
  logged_by: string;
  logged_at: string;
  created_at: string;
}

export type DocumentCategory = 'medical' | 'legal' | 'insurance' | 'general';

export interface Document {
  id: string;
  family_id: string;
  name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: DocumentCategory;
  uploaded_by: string;
  created_at: string;
}

export type CheckInMood = 'great' | 'good' | 'okay' | 'concerning' | 'emergency';

export interface CheckIn {
  id: string;
  family_id: string;
  mood: CheckInMood;
  summary: string;
  notes: string | null;
  submitted_by: string;
  created_at: string;
}

export interface VisitPrepSummary {
  id: string;
  family_id: string;
  content: string;
  generated_at: string;
  created_by: string;
  created_at: string;
  /** Optional user-defined title; date/time always shown from `generated_at`. */
  display_name?: string | null;
}

/** Care provider contact; optional links to medications (e.g. cardiologist ↔ BP meds). */
export interface FamilyNote {
  id: string;
  family_id: string;
  body: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Joined from profiles; populated when using select with profile join. */
  author_name?: string | null;
}

export type InteractionSeverity = 'mild' | 'moderate' | 'severe';

export interface MedicationInteractionResult {
  medicationName1: string;
  medicationName2: string;
  severity: InteractionSeverity;
  description: string;
  source: 'rxnorm' | 'ai';
}

export interface FamilyDoctor {
  id: string;
  family_id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  address: string | null;
  next_appointment_at: string | null;
  linked_medication_ids: string[];
  created_by: string;
  created_at: string;
}
