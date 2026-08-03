import { t } from "@/i18n";
import type { HSVColor } from "@/types/challenge";
import { hsvToLab } from "@/utils/color";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function normalizeHueAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * Circular distance between two hues (0..360), returned in the 0..180 range.
 * Exported because it is a small, well-defined piece of logic worth testing.
 */
export function getCircularHueDistance(
  leftHue: number,
  rightHue: number,
): number {
  const normalizedLeft = normalizeHueAngle(leftHue);
  const normalizedRight = normalizeHueAngle(rightHue);
  const rawDistance = Math.abs(normalizedLeft - normalizedRight);

  return Math.min(rawDistance, 360 - rawDistance);
}

/**
 * CIEDE2000 color difference between two CIELAB colors.
 *
 * Industry-standard perceptual metric: ΔE ~1 is barely perceptible, ~2-3 is a
 * close match, and >10 is clearly different. It models how the eye actually
 * perceives color differences, which the previous linear HSV distance could
 * not capture (dark and highly saturated colors were scored unfairly).
 */
export function deltaE2000(
  lab1: [number, number, number],
  lab2: [number, number, number],
): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;

  const kL = 1;
  const kC = 1;
  const kH = 1;

  const c1 = Math.sqrt(a1 * a1 + b1 * b1);
  const c2 = Math.sqrt(a2 * a2 + b2 * b2);
  const cBar = (c1 + c2) / 2;

  const cBar7 = Math.pow(cBar, 7);
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + Math.pow(25, 7))));

  const a1Prime = a1 * (1 + g);
  const a2Prime = a2 * (1 + g);

  const c1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const c2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);

  const h1Prime = normalizeHueAngle(radToDeg(Math.atan2(b1, a1Prime)));
  const h2Prime = normalizeHueAngle(radToDeg(Math.atan2(b2, a2Prime)));

  const deltaLPrime = l2 - l1;
  const deltaCPrime = c2Prime - c1Prime;

  let deltahPrime: number;
  if (c1Prime * c2Prime === 0) {
    deltahPrime = 0;
  } else if (Math.abs(h2Prime - h1Prime) <= 180) {
    deltahPrime = h2Prime - h1Prime;
  } else if (h2Prime - h1Prime > 180) {
    deltahPrime = h2Prime - h1Prime - 360;
  } else {
    deltahPrime = h2Prime - h1Prime + 360;
  }

  const deltaHPrime =
    2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(degToRad(deltahPrime) / 2);

  const lBarPrime = (l1 + l2) / 2;
  const cBarPrime = (c1Prime + c2Prime) / 2;

  let hBarPrime: number;
  if (c1Prime * c2Prime === 0) {
    hBarPrime = h1Prime + h2Prime;
  } else if (Math.abs(h1Prime - h2Prime) <= 180) {
    hBarPrime = (h1Prime + h2Prime) / 2;
  } else if (h1Prime + h2Prime < 360) {
    hBarPrime = (h1Prime + h2Prime + 360) / 2;
  } else {
    hBarPrime = (h1Prime + h2Prime - 360) / 2;
  }

  const t =
    1 -
    0.17 * Math.cos(degToRad(hBarPrime - 30)) +
    0.24 * Math.cos(degToRad(2 * hBarPrime)) +
    0.32 * Math.cos(degToRad(3 * hBarPrime + 6)) -
    0.2 * Math.cos(degToRad(4 * hBarPrime - 63));

  const deltaTheta = 30 * Math.exp(-Math.pow((hBarPrime - 275) / 25, 2));
  const cBarPrime7 = Math.pow(cBarPrime, 7);
  const rc = 2 * Math.sqrt(cBarPrime7 / (cBarPrime7 + Math.pow(25, 7)));
  const sl =
    1 +
    (0.015 * Math.pow(lBarPrime - 50, 2)) /
      Math.sqrt(20 + Math.pow(lBarPrime - 50, 2));
  const sc = 1 + 0.045 * cBarPrime;
  const sh = 1 + 0.015 * cBarPrime * t;
  const rt = -Math.sin(degToRad(2 * deltaTheta)) * rc;

  const lTerm = deltaLPrime / (kL * sl);
  const cTerm = deltaCPrime / (kC * sc);
  const hTerm = deltaHPrime / (kH * sh);

  return Math.sqrt(
    lTerm * lTerm + cTerm * cTerm + hTerm * hTerm + rt * cTerm * hTerm,
  );
}

// Perceptual scale that turns a ΔE distance into a 0..100 score. The
// exponential decay keeps the curve intuitive: near-perfect matches score in
// the high 90s, a close match (~ΔE 2) lands around 90, and a noticeably wrong
// color (~ΔE 20) drops into the 30s.
const SCORE_DECAY = 22;

// Below this ΔE the eye cannot tell the colors apart, so we award a full 100 to
// keep the "perfect" feedback attainable.
const PERFECT_DELTA_E = 1;

/**
 * Perceptual score (0..100) for how close the player's color is to the target.
 * Backed by CIEDE2000 so the number reflects what the eye actually sees.
 */
export function calculateColorScore(
  selected: HSVColor,
  target: HSVColor,
): number {
  const distance = deltaE2000(hsvToLab(selected), hsvToLab(target));

  if (distance <= PERFECT_DELTA_E) {
    return 100;
  }

  const score = 100 * Math.exp(-distance / SCORE_DECAY);
  return clamp(Math.round(score), 0, 100);
}

export interface HSVDelta {
  h: number;
  s: number;
  v: number;
}

/**
 * Absolute per-channel difference between the player's color and the target,
 * used by the result screen to give actionable feedback. Hue uses the circular
 * distance so it never reports more than 180.
 */
export function getHSVDelta(selected: HSVColor, target: HSVColor): HSVDelta {
  return {
    h: Math.round(getCircularHueDistance(selected.h, target.h)),
    s: Math.round(Math.abs(selected.s - target.s)),
    v: Math.round(Math.abs(selected.v - target.v)),
  };
}

export function getScoreMessage(score: number): string {
  if (score >= 100) return t("score.perfect");
  if (score >= 90) return t("score.close");
  if (score >= 60) return t("score.good");
  return t("score.tryAgain");
}

/**
 * Star rating (0..3) derived from a score. Handy for compact summaries and for
 * a future leaderboard/multiplayer comparison.
 */
export function getScoreStars(score: number): number {
  if (score >= 90) {
    return 3;
  }
  if (score >= 70) {
    return 2;
  }
  if (score >= 45) {
    return 1;
  }
  return 0;
}

export interface RunSummary {
  total: number;
  max: number;
  average: number;
  rounds: number;
  stars: number;
}

/**
 * Aggregates a full run. Kept pure so the local summary screen and any future
 * server-side ranking can share the exact same aggregation.
 */
export function summarizeRun(scores: readonly number[]): RunSummary {
  const rounds = scores.length;
  const total = scores.reduce((sum, value) => sum + value, 0);
  const max = rounds * 100;
  const average = rounds > 0 ? Math.round(total / rounds) : 0;

  return {
    total,
    max,
    average,
    rounds,
    stars: getScoreStars(average),
  };
}

export function getRunMessage(average: number): string {
  if (average >= 90) return t("run.artist");
  if (average >= 75) return t("run.great");
  if (average >= 55) return t("run.good");
  return t("run.practice");
}
