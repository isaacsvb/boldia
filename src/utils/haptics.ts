/**
 * Thin wrapper around expo-haptics so screens express intent, not raw API.
 * Fails silently on platforms/devices without a haptics engine.
 */
import * as Haptics from 'expo-haptics';

export const haptics = {
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}),
  press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}),
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}),
  success: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}),
  warning: () =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}),
};

/** Celebrate a high pronunciation score with escalating feedback. */
export function celebrateScore(score: number) {
  if (score >= 85) haptics.success();
  else if (score >= 70) haptics.warning();
  else haptics.error();
}
