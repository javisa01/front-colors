import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

// Haptics are a native-only nicety. On web the module is a no-op, but we still
// guard every call so a missing/older engine can never throw during play.

function isSupported(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export function selectionTick(): void {
  if (!isSupported()) {
    return;
  }
  Haptics.selectionAsync().catch(() => undefined);
}

export function impact(strength: "light" | "medium" | "heavy" = "light"): void {
  if (!isSupported()) {
    return;
  }

  const style =
    strength === "heavy"
      ? Haptics.ImpactFeedbackStyle.Heavy
      : strength === "medium"
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light;

  Haptics.impactAsync(style).catch(() => undefined);
}

export function notify(
  type: "success" | "warning" | "error" = "success",
): void {
  if (!isSupported()) {
    return;
  }

  const feedback =
    type === "error"
      ? Haptics.NotificationFeedbackType.Error
      : type === "warning"
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success;

  Haptics.notificationAsync(feedback).catch(() => undefined);
}

/**
 * Chooses a haptic that matches how well the player did, so the phone "feels"
 * the result: a strong success for great guesses, a soft warning otherwise.
 */
export function feedbackForScore(score: number): void {
  if (score >= 90) {
    notify("success");
  } else if (score >= 60) {
    impact("medium");
  } else {
    impact("light");
  }
}
