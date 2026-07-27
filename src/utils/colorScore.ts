import type { HSVColor } from "@/types/challenge";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getCircularHueDistance(leftHue: number, rightHue: number): number {
  const normalizedLeft = ((leftHue % 360) + 360) % 360;
  const normalizedRight = ((rightHue % 360) + 360) % 360;
  const rawDistance = Math.abs(normalizedLeft - normalizedRight);

  return Math.min(rawDistance, 360 - rawDistance);
}

/**
 * Fórmula de puntuación:
 * - Hue pesa más porque es el rasgo visual más identificable.
 * - Saturation y Value completan la percepción del color.
 *
 * Distancia total ponderada:
 * 50% Hue + 25% Saturation + 25% Value
 *
 * Se transforma a un rango final de 0..100.
 */
export function calculateColorScore(
  selected: HSVColor,
  target: HSVColor,
): number {
  const hueDistance = getCircularHueDistance(selected.h, target.h) / 180;
  const saturationDistance = Math.abs(selected.s - target.s) / 100;
  const valueDistance = Math.abs(selected.v - target.v) / 100;

  const weightedDistance =
    hueDistance * 0.5 + saturationDistance * 0.25 + valueDistance * 0.25;

  const normalizedScore = 1 - clamp(weightedDistance, 0, 1);

  return clamp(Math.round(normalizedScore * 100), 0, 100);
}

export function getScoreMessage(score: number): string {
  if (score >= 100) {
    return "🎉 ¡Perfecto!";
  }

  if (score >= 90) {
    return "¡Muy cerca!";
  }

  if (score >= 70) {
    return "Buen intento";
  }

  return "Sigue probando";
}
