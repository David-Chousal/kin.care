import type { CheckInMood } from '../../types';

export interface MoodMeta {
  key: CheckInMood;
  label: string;
  mci: string;
  color: string;
}

export const MOODS: MoodMeta[] = [
  { key: 'great',      label: 'Great',     mci: 'emoticon-happy-outline',   color: '#10B981' },
  { key: 'good',       label: 'Good',      mci: 'emoticon-outline',          color: '#3B82F6' },
  { key: 'okay',       label: 'Okay',      mci: 'emoticon-neutral-outline',  color: '#F59E0B' },
  { key: 'concerning', label: 'Concerning', mci: 'emoticon-sad-outline',     color: '#EF4444' },
  { key: 'emergency',  label: 'Emergency', mci: 'alert-octagon-outline',     color: '#DC2626' },
];

export function moodMeta(mood: CheckInMood): MoodMeta {
  return MOODS.find((m) => m.key === mood) ?? MOODS[1];
}
