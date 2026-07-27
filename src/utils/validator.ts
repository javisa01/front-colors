import type { ChallengeColor, HSVColor } from "@/types/challenge";
import { isWithinTolerance } from "@/utils/color";

export interface ValidationResult {
  isCorrect: boolean;
  message: string;
}

export function validateChallenge(
  selected: HSVColor,
  target: ChallengeColor,
  tolerance: HSVColor,
): ValidationResult {
  const isCorrect = target?.hsv
    ? isWithinTolerance(selected, target.hsv, tolerance)
    : false;

  return {
    isCorrect,
    message: isCorrect ? "🎉 ¡Correcto!" : "❌ Sigue probando.",
  };
}
