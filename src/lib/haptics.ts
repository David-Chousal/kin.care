import * as Haptics from 'expo-haptics';
import { useAccessibilityStore } from '../store/accessibility';

export { ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

function enabled(): boolean {
  return useAccessibilityStore.getState().hapticsEnabled;
}

export function hapticImpact(style: Haptics.ImpactFeedbackStyle): void {
  if (!enabled()) return;
  void Haptics.impactAsync(style);
}

export function hapticSelection(): void {
  if (!enabled()) return;
  void Haptics.selectionAsync();
}

export function hapticNotification(type: Haptics.NotificationFeedbackType): void {
  if (!enabled()) return;
  void Haptics.notificationAsync(type);
}
