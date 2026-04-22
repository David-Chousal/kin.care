import { AccessibilityInfo } from 'react-native';

/**
 * Announces a short message for assistive technologies (VoiceOver / TalkBack).
 * Prefer `FormError` for validation UI; use this for one-off announcements when needed.
 */
export function announceForAccessibility(message: string): void {
  const text = message.trim();
  if (!text) return;
  void AccessibilityInfo.announceForAccessibility(text);
}
